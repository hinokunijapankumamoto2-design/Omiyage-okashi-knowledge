import { openDatabase, closeDatabase } from "./index.js";
import { seedIfEmpty } from "./seed.js";

openDatabase();
seedIfEmpty();
closeDatabase();
console.log("seed complete");
