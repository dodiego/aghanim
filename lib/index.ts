import { Parser } from './parser'
import { Client, ClientConfig } from 'pg'
import { PropertyMap, CreateIndexOptions } from './types'

async function _handleTransaction(fn: (parser: Parser) => Promise<any>, client: Client) {
  const parser = new Parser()
  try {
    await client.query('BEGIN')
    const result = await fn(parser)
    await client.query('COMMIT')
    return result
  } catch (error) {
    client.query('ROLLBACK')
    throw error
  }
}

async function _runQuery(client: Client, { query, params = undefined }): Promise<import('pg').QueryArrayResult> {
  const result = await client.query(query, params)
  return result
}

async function _createSchema(json, client) {
  return await _handleTransaction(async parser => {
    const { relationshipNames, nodeLabels } = parser.getSchema(json)
    const clientQueries = []
    for (const vlabel of nodeLabels) {
      clientQueries.push(`CREATE VLABEL IF NOT EXISTS ${vlabel}`)
    }
    for (const elabel of relationshipNames) {
      clientQueries.push(`CREATE ELABEL IF NOT EXISTS ${elabel}`)
    }

    return await _runQuery(client, {
      query: clientQueries.join(';')
    })
  }, client)
}

async function _handleParseRows(parser, client, statement, options) {
  const response: any = await _runQuery(client, statement)
  if (!response.rows.length || !response.rows[0].cypher_info) {
    return []
  }
  return parser.parseRows(response.rows, statement.rootKey, {
    ...options,
    graph: statement.graph
  })
}

class Konekto {
  client: Client
  plugins: any[]
  sqlMappings: PropertyMap
  constructor(
    clientConfig: ClientConfig | string = {
      database: 'agens',
      user: 'agens',
      password: 'agens'
    }
  ) {
    this.client = new Client(clientConfig)
    this.plugins = []
    this.sqlMappings = {}
  }

  connect() {
    return this.client.connect()
  }

  setSqlMappings(mappings: PropertyMap) {
    this.sqlMappings = mappings
  }

  async createSchema(jsonOrArray) {
    if (Array.isArray(jsonOrArray)) {
      return await Promise.all(jsonOrArray.map(json => _createSchema(json, this.client)))
    }
    return _createSchema(jsonOrArray, this.client)
  }

  async createLabel(label) {
    if (typeof label === 'string') {
      return await _runQuery(this.client, {
        query: `CREATE ELABEL ${label}`
      })
    }

    if (Array.isArray(label)) {
      return label.map(item => _runQuery(this.client, { query: `CREATE ELABEL ${item}` }))
    }

    throw new Error('invalid label type, must be string or array of string')
  }

  async createRelationship(name) {
    if (typeof name === 'string') {
      return await _runQuery(this.client, {
        query: `CREATE VLABEL ${name}`
      })
    }

    if (Array.isArray(name)) {
      return name.map(item => _runQuery(this.client, { query: `CREATE VLABEL ${item}` }))
    }
    throw new Error('invalid label type, must be string or array of string')
  }

  async createIndex(label: string, property: string, options: CreateIndexOptions = {}) {
    const queryParts = ['CREATE']
    if (options.unique) {
      queryParts.push('UNIQUE')
    }
    queryParts.push('PROPERTY INDEX')
    queryParts.push(`IF NOT EXISTS ${label}_${property} ON ${label}`)
    if (options.type) {
      queryParts.push(`USING ${options.type}`)
    }
    queryParts.push(`(${property}`)
    if (options.order) {
      queryParts.push(options.order)
    }
    if (options.nullOrder) {
      queryParts.push(`NULLS ${options.nullOrder}`)
    }
    queryParts.push(')')
    if (options.where) {
      queryParts.push(`WHERE ${options.where}`)
    }
    const query = queryParts.join(' ')
    return await _runQuery(this.client, { query })
  }

  async dropIndex(label, property, options) {
    if (options.cascade) {
      await _runQuery(this.client, { query: `DROP PROPERTY INDEX ${label}_${property} CASCADE` })
    } else {
      await _runQuery(this.client, { query: `DROP PROPERTY INDEX ${label}_${property} RESTRICT` })
    }
  }

  async raw({ query, params = undefined }, options: any = {}) {
    const parser = new Parser()
    const rows = await _runQuery(this.client, { query, params })
    if (options.parseResult) {
      return await parser.parseRows(rows, options.rootKey, options)
    }
    return rows
  }

  async save(json, options = {}) {
    return await _handleTransaction(async parser => {
      let items = []
      if (Array.isArray(json)) {
        items = json
      } else {
        items.push(json)
      }
      const result = await Promise.all(
        items.map(async item => {
          const statement = await parser.jsonToCypherWrite(item, { sqlProjections: this.sqlMappings, ...options })
          await Promise.all([_runQuery(this.client, statement.cypher), _runQuery(this.client, statement.sql)])
          return statement.cypher.graph.root._id
        })
      )

      if (Array.isArray(json)) {
        return result
      }
      return result[0]
    }, this.client)
  }

  async findByQueryObject(queryObject, options = {}) {
    return await _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRead(queryObject, { sqlProjections: this.sqlMappings, ...options })
      return await _handleParseRows(parser, this.client, statement, options)
    }, this.client)
  }

  async findOneByQueryObject(queryObject, options = {}) {
    return (await this.findByQueryObject(queryObject, options))[0]
  }

  async findById(id, options = {}) {
    return await _handleTransaction(async parser => {
      const statement = {
        query: 'MATCH (v1 {_id: $1}) WITH v1 OPTIONAL MATCH (v1)-[r*0..]->(v2) RETURN v1, r, v2',
        params: [`"${id}"`],
        rootKey: 'v1'
      }
      statement.query = parser.getFinalQuery(['v1', 'v2'], statement.query, {
        sqlProjections: this.sqlMappings,
        ...options
      })
      const result = await _handleParseRows(parser, this.client, statement, options)
      return result[0]
    }, this.client)
  }

  async deleteByQueryObject(queryObject, options = {}) {
    return await _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRead(queryObject, options)
      const nodeIds = []
      const konektoIds = {}
      const sqlMappings = this.sqlMappings.delete
      parser.on('read', node => {
        nodeIds.push(`v._id = '${node._id}'`)
        if (sqlMappings) {
          const mapping = sqlMappings[node._label].table
          if (!konektoIds[mapping]) {
            konektoIds[mapping] = []
          }
          konektoIds[mapping].push(`_id = '${node.konekto_id}'`)
        }
      })
      const result = await _handleParseRows(parser, this.client, statement, options)
      if (result.length) {
        const queries = [this.client.query(`MATCH (v) WHERE ${nodeIds.join(' OR ')} DETACH DELETE v`)]
        if (sqlMappings) {
          queries.push(
            this.client.query(
              Object.entries<any>(konektoIds)
                .map(([table, ids]) => `DELETE FROM ${table} WHERE ${ids.join(' OR ')}`)
                .join('\n')
            )
          )
        }
        await Promise.all(queries)
      }
      return result
    }, this.client)
  }

  async deleteById(id, options) {
    const statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH (a)-[r*0..]->(b)\nDETACH DELETE a, b',
      params: [id],
      rootKey: 'a'
    }
    return await _handleTransaction(async parser => {
      const result = await _handleParseRows(parser, this.client, statement, options)
      return result[0]
    }, this.client)
  }

  async deleteRelationshipsByQueryObject(queryObject, options) {
    return await _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRelationshipDelete(queryObject, options)
      return await this.client.query(statement.query, statement.params)
    }, this.client)
  }

  async createGraph(graphName: string) {
    await this.client.query(`CREATE GRAPH IF NOT EXISTS ${graphName}`)
  }

  async setGraph(graphName: string) {
    await this.client.query(`SET graph_path = ${graphName}`)
  }

  disconnect() {
    return this.client.end()
  }
}

export default Konekto
