const neo4j = require('neo4j-driver').v1
const cypherMapper = require('./mappers/cypher')

module.exports = class Aghanim {
  constructor (connection = {}, neo4jOptions) {
    let auth = connection.auth ? neo4j.auth.basic(connection.auth.username, connection.auth.password) : undefined
    this.driver = neo4j.driver(`${connection.protocol || 'bolt'}://${connection.host || 'localhost'}`, auth, neo4jOptions)
  }

  async write (json) {
    let session = this.driver.session()
    let statement = cypherMapper.jsonToWriteStatement(json)
    await session.run(statement.cypher, statement.parameters)
    return statement.root
  }

  async read (queryObject, options) {
    let session = this.driver.session()
    let statement = cypherMapper.queryObjectMapper(queryObject)
    let result = await session.run(statement.cypher, statement.parameters)
    session.close()
    return cypherMapper.readStatementResultParser.toJson(result, options)
  }

  async remove (queryObject, options) {
    options = Object.assign({}, { returnResults: false, parseResults: true, parseOptions: null }, options)
    let session = this.driver.session()
    let statement = cypherMapper.queryObjectMapper(queryObject)
    let result = await session.run(statement.cypher, statement.parameters)
    let uuids = cypherMapper.readStatementResultParser.toUuidArray(result)
    await session.run(`MATCH (n) WHERE n.uuid in $uuids DETACH DELETE n`, { uuids })
    session.close()
    if (options.returnResults) {
      if (options.parseResults) {
        return cypherMapper.readStatementResultParser.toJson(result, options.parseOptions)
      } else {
        return uuids
      }
    }
  }
}
