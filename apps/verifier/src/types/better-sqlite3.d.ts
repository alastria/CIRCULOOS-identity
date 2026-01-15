declare module 'better-sqlite3' {
  interface Options {
    readonly fileMustExist?: boolean
    readonly readonly?: boolean
    readonly verbose?: (...args: any[]) => void
  }

  interface Database {
    prepare(sql: string): { run(...args: any[]): any; get(...args: any[]): any; all(...args: any[]): any[] }
    exec(sql: string): void
    close(): void
  }

  function BetterSqlite3(filename: string, options?: Options): Database

  export = BetterSqlite3
}
declare module 'better-sqlite3' {
  const whatever: any
  export default whatever
}
