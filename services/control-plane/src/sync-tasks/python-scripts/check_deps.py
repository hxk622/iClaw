import importlib

packages = ['akshare', 'efinance', 'psycopg2', 'pandas', 'requests']
missing = []

for pkg in packages:
    try:
        importlib.import_module(pkg)
        print(f'✓ {pkg} is installed')
    except ImportError:
        print(f'✗ {pkg} is missing')
        missing.append(pkg)

if missing:
    print(f"\nMissing packages: {', '.join(missing)}")
    exit(1)
else:
    print("\nAll dependencies are installed!")
    exit(0)
