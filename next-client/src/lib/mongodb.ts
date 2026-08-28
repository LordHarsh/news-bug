import { MongoClient, Db, MongoClientOptions } from 'mongodb';

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10_000,
};

// Cache the client promise on globalThis so hot reloads in development and
// warm serverless invocations in production reuse the same connection pool.
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it to next-client/.env.local (see .env.example).'
    );
  }
  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = new MongoClient(uri, options)
      .connect()
      .catch((err) => {
        // Clear the cache so the next call retries instead of returning a
        // permanently rejected promise.
        globalWithMongo._mongoClientPromise = undefined;
        throw err;
      });
  }
  return globalWithMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || 'disease-data');
}

export default getDb;
