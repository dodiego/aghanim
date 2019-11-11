const Konekto = require('../lib')
const { where, sqlWhere } = require('../lib/parser')
const konekto = new Konekto()

describe('find sql', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.setSqlMappings({
      test: {
        table: 'dates',
        mappings: {
          test_date: 'test_date'
        }
      }
    })
    await konekto.createGraph('find_sql_test')
    return konekto.setGraph('find_sql_test')
  })

  afterEach(async () => {
    return konekto.deleteByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(async () => {
    await konekto.raw({ query: 'DELETE FROM public.dates' })
    return konekto.disconnect()
  })
  test('sql where equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: 'test_date = :date', table: 'dates', params: { date: '2013-07-09' } }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where different', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date != '2013-07-10'", table: 'dates' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date > '2013-07-08'", table: 'dates' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date >= '2013-07-09'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date < '2013-07-10'", table: 'dates' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where lesser than equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date <= '2013-07-09'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where not', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "NOT dates.test_date = '2013-07-08'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than and lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "dates.test_date > '2013-07-08' AND test_date < '2019-07-10'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than or lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "dates.test_date > '2013-07-08' OR dates.test_date < '2019-07-09'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where boolean', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "(test_date = '2013-07-09') and true", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where between', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date BETWEEN '2013-07-08' AND '2019-07-09'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where cast', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "test_date::text = '2013-07-09'", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where function', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      [where]: { filter: 'id({this}) = :id', params: { id } },
      [sqlWhere]: { filter: "date_part('year', test_date) = 2013", table: 'dates' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql projection', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject(
      {
        _label: 'test',
        [where]: { filter: 'id({this}) = :id', params: { id } },
        [sqlWhere]: { filter: "date_part('year', test_date) = 2013", table: 'dates' }
      },
      {
        projections: {
          dates: {
            year: "date_part('year', {test_date})"
          }
        }
      }
    )
    json.year = 2013
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql substitution', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject(
      {
        _label: 'test',
        [where]: { filter: 'id({this}) = :id', params: { id } },
        [sqlWhere]: { filter: "date_part('year', test_date) = 2013", table: 'dates' }
      },
      {
        projections: {
          dates: {
            test_date: "date_part('year', {test_date})"
          }
        }
      }
    )
    json.test_date = 2013
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })
})
