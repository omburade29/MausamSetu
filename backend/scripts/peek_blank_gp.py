import duckdb

url = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/panchayats/LGD_panchayats.parquet"
con = duckdb.connect()
print(
    con.execute(
        """
        SELECT
          count(*) FILTER (WHERE gp_name IS NULL OR trim(gp_name) = '') AS blank,
          count(*) FILTER (WHERE (gp_name IS NULL OR trim(gp_name) = '') AND nullif(trim(b_pan_name), '') IS NOT NULL) AS b_pan,
          count(*) FILTER (WHERE (gp_name IS NULL OR trim(gp_name) = '') AND nullif(trim(vilname11), '') IS NOT NULL) AS village,
          count(*) FILTER (WHERE (gp_name IS NULL OR trim(gp_name) = '') AND nullif(trim(pan_local), '') IS NOT NULL) AS pan_local
        FROM read_parquet(?)
        """,
        [url],
    ).fetchall()
)
print(
    con.execute(
        """
        SELECT gpcode, b_pan_name, vilname11, pan_local, block_name
        FROM read_parquet(?)
        WHERE gp_name IS NULL OR trim(gp_name) = ''
        LIMIT 12
        """,
        [url],
    ).fetchall()
)
