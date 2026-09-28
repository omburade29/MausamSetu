import duckdb

URLS = {
    "states": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.parquet",
    "districts": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/districts/LGD_Districts.parquet",
    "blocks": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/blocks/LGD_Blocks.parquet",
    "panchayats": "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/panchayats/LGD_panchayats.parquet",
}

con = duckdb.connect()
for name, url in URLS.items():
    rows = con.execute("DESCRIBE SELECT * FROM read_parquet(?)", [url]).fetchall()
    print(name)
    for row in rows:
        print(" ", row[0], row[1])
