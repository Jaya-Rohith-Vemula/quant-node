import knex from "knex";
import type { Knex } from "knex";
import oracledb from "oracledb";
import "dotenv/config";

const dbConfig: any = {
    client: "oracledb",
};

export const db: Knex = knex(dbConfig);
(db.client as any).driver = oracledb;

// Performance tuning for large data sets
oracledb.fetchArraySize = 10000;
oracledb.prefetchRows = 10000;
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let persistentConn: any = null;

export async function getConn() {
    if (persistentConn) {
        try {
            // Check if connection is still alive
            await persistentConn.execute('SELECT 1 FROM DUAL');
            return persistentConn;
        } catch (err) {
            console.log("Persistent connection lost, reconnecting...");
            persistentConn = null;
        }
    }

    console.log("Opening new Oracle connection...");
    persistentConn = await oracledb.getConnection({
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        connectString: process.env.DB_CONNECT_STRING!,
        walletLocation: process.env.TNS_ADMIN!,
        walletPassword: process.env.DB_PASSWORD!,
    });
    console.log("Oracle connection established.");
    return persistentConn;
}

export async function closeConn() {
    if (persistentConn) {
        await persistentConn.close();
        persistentConn = null;
    }
}
