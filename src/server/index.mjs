import { ChatServer } from './ChatServer.mjs'
import { openDatabase } from './db/openDb.mjs'
import { initDb } from './db/initDb.mjs'
import { createLogger } from './util/logger.mjs'

const logger = createLogger()
const port = Number(process.env.PORT || 3000)
const dbPath = process.env.DB_PATH || './data/chat.db'

const db = openDatabase(dbPath)
initDb(db)

const server = new ChatServer({ db, logger })

server.listen(port)

logger.info('server.start', { port, dbPath })
