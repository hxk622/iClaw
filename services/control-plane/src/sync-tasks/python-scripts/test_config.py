#!/usr/bin/env python3
"""
Test configuration and network connectivity for market data sync scripts
Handles proxy configuration and data source connectivity testing
"""

import os
import sys
import requests
import socket
from typing import Dict, Optional, Tuple

# Configuration - Use actual working endpoints for each data source
TEST_URLS = {
    'akshare': 'https://web.ifzq.com/gp/api/gp/getGpList?type=hs&sort=zf&order=desc&page=1&limit=10',  # AKShare compatible endpoint
    'efinance': 'https://quote.eastmoney.com/zs000001.html',  # EastMoney main site
    'tushare': 'https://api.tushare.pro/'
}

PROXY_CONFIG = {
    # Proxy options - set environment variables to override
    'http_proxy': os.getenv('HTTP_PROXY', os.getenv('http_proxy', '')),
    'https_proxy': os.getenv('HTTPS_PROXY', os.getenv('https_proxy', '')),
    'no_proxy': os.getenv('NO_PROXY', os.getenv('no_proxy', 'localhost,127.0.0.1')),
    'socks_proxy': os.getenv('SOCKS_PROXY', os.getenv('socks_proxy', ''))
}

# Best configuration found
BEST_CONFIG = {
    'mode': 'direct',
    'proxies': None,
    'working_sources': []
}


def test_akshare_api() -> Tuple[bool, float, str]:
    """Test AKShare API directly"""
    try:
        import time
        import akshare
        start_time = time.time()
        df = akshare.stock_zh_a_spot()
        response_time = (time.time() - start_time) * 1000
        if len(df) > 4000:
            return True, response_time, f"Got {len(df)} stocks ({response_time:.0f}ms)"
        else:
            return False, 0, f"Insufficient data: only {len(df)} stocks"
    except Exception as e:
        return False, 0, str(e)


def test_efinance_api() -> Tuple[bool, float, str]:
    """Test efinance API directly"""
    try:
        import time
        import efinance as ef
        start_time = time.time()
        df = ef.stock.get_realtime_quotes()
        response_time = (time.time() - start_time) * 1000
        if len(df) > 4000:
            return True, response_time, f"Got {len(df)} stocks ({response_time:.0f}ms)"
        else:
            return False, 0, f"Insufficient data: only {len(df)} stocks"
    except Exception as e:
        return False, 0, str(e)


def test_tushare_api() -> Tuple[bool, float, str]:
    """Test Tushare API connectivity"""
    try:
        import time
        start_time = time.time()
        response = requests.get(TEST_URLS['tushare'], timeout=10)
        response_time = (time.time() - start_time) * 1000
        response.raise_for_status()
        return True, response_time, f"API accessible ({response_time:.0f}ms)"
    except Exception as e:
        return False, 0, str(e)


def test_direct_connectivity() -> Dict:
    """Test connectivity without proxy"""
    results = {}
    print("\nTesting direct connectivity (no proxy):")
    print("-" * 60)

    working = []

    # Test AKShare
    success, rtt, msg = test_akshare_api()
    status = "✓" if success else "✗"
    print(f"{status} akshare    {'API call':<40} {msg}")
    results['akshare'] = {'success': success, 'rtt': rtt, 'message': msg}
    if success:
        working.append('akshare')

    # Test efinance
    success, rtt, msg = test_efinance_api()
    status = "✓" if success else "✗"
    print(f"{status} efinance   {'API call':<40} {msg}")
    results['efinance'] = {'success': success, 'rtt': rtt, 'message': msg}
    if success:
        working.append('efinance')

    # Test Tushare
    success, rtt, msg = test_tushare_api()
    status = "✓" if success else "✗"
    print(f"{status} tushare    {TEST_URLS['tushare']:<40} {msg}")
    results['tushare'] = {'success': success, 'rtt': rtt, 'message': msg}
    if success:
        working.append('tushare')

    if working:
        BEST_CONFIG['mode'] = 'direct'
        BEST_CONFIG['proxies'] = None
        BEST_CONFIG['working_sources'] = working

    return results


def test_http_proxy() -> Dict:
    """Test connectivity with HTTP/HTTPS proxy"""
    if not PROXY_CONFIG['http_proxy'] or not PROXY_CONFIG['https_proxy']:
        print("\nHTTP/HTTPS proxy not configured, skipping test")
        return {}

    proxies = {
        'http': PROXY_CONFIG['http_proxy'],
        'https': PROXY_CONFIG['https_proxy']
    }

    results = {}
    print(f"\nTesting HTTP proxy connectivity ({PROXY_CONFIG['http_proxy']}):")
    print("-" * 60)

    working = []
    for source, url in TEST_URLS.items():
        success, rtt, msg = test_connection(url, proxies=proxies)
        status = "✓" if success else "✗"
        print(f"{status} {source:<10} {url:<40} {msg}")
        results[source] = {
            'success': success,
            'rtt': rtt,
            'message': msg
        }
        if success:
            working.append(source)

    if working and len(BEST_CONFIG['working_sources']) < len(working):
        BEST_CONFIG['mode'] = 'http_proxy'
        BEST_CONFIG['proxies'] = proxies
        BEST_CONFIG['working_sources'] = working

    return results


def test_socks_proxy() -> Dict:
    """Test connectivity with SOCKS5 proxy"""
    if not PROXY_CONFIG['socks_proxy']:
        print("\nSOCKS5 proxy not configured, skipping test")
        return {}

    proxies = {
        'http': PROXY_CONFIG['socks_proxy'],
        'https': PROXY_CONFIG['socks_proxy']
    }

    results = {}
    print(f"\nTesting SOCKS5 proxy connectivity ({PROXY_CONFIG['socks_proxy']}):")
    print("-" * 60)

    working = []
    for source, url in TEST_URLS.items():
        success, rtt, msg = test_connection(url, proxies=proxies)
        status = "✓" if success else "✗"
        print(f"{status} {source:<10} {url:<40} {msg}")
        results[source] = {
            'success': success,
            'rtt': rtt,
            'message': msg
        }
        if success:
            working.append(source)

    if working and len(BEST_CONFIG['working_sources']) < len(working):
        BEST_CONFIG['mode'] = 'socks_proxy'
        BEST_CONFIG['proxies'] = proxies
        BEST_CONFIG['working_sources'] = working

    return results


def get_network_info() -> Dict:
    """Get current network configuration info"""
    return {
        'hostname': socket.gethostname(),
        'ip_address': socket.gethostbyname(socket.gethostname()),
        'http_proxy': PROXY_CONFIG['http_proxy'],
        'https_proxy': PROXY_CONFIG['https_proxy'],
        'socks_proxy': PROXY_CONFIG['socks_proxy'],
        'no_proxy': PROXY_CONFIG['no_proxy']
    }


def print_best_config():
    """Print the best working configuration"""
    print("\n" + "=" * 60)
    print("BEST NETWORK CONFIGURATION")
    print("=" * 60)
    print(f"Mode: {BEST_CONFIG['mode']}")
    if BEST_CONFIG['proxies']:
        print(f"Proxies: {BEST_CONFIG['proxies']}")
    print(f"Working sources: {', '.join(BEST_CONFIG['working_sources'])}")

    if len(BEST_CONFIG['working_sources']) == len(TEST_URLS):
        print("\n✓ All data sources are accessible with this configuration!")
    else:
        print(f"\n⚠ WARNING: Only {len(BEST_CONFIG['working_sources'])}/{len(TEST_URLS)} sources are accessible")
        missing = [s for s in TEST_URLS.keys() if s not in BEST_CONFIG['working_sources']]
        print(f"Missing sources: {', '.join(missing)}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test network connectivity for market data sync')
    parser.add_argument('--test-connectivity', action='store_true', help='Run full connectivity tests')
    parser.add_argument('--show-config', action='store_true', help='Show current network configuration')
    args = parser.parse_args()

    if args.show_config:
        info = get_network_info()
        print("Current Network Configuration:")
        print("-" * 40)
        for k, v in info.items():
            print(f"{k:<15}: {v}")
        return

    if args.test_connectivity:
        # Test all connectivity modes
        test_direct_connectivity()
        test_http_proxy()
        test_socks_proxy()

        print_best_config()

        # Return non-zero if no sources are accessible
        if len(BEST_CONFIG['working_sources']) == 0:
            print("\nERROR: No data sources are accessible!")
            sys.exit(1)
        elif len(BEST_CONFIG['working_sources']) < len(TEST_URLS):
            print(f"\n⚠ NOTE: {len(BEST_CONFIG['working_sources'])}/{len(TEST_URLS)} sources are accessible")
            print("Multi-source fallback will use available sources")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
