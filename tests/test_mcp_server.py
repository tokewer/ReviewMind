# -*- coding: utf-8 -*-
import unittest
import threading
import time
import json
import urllib.request
import urllib.parse
from server import ThreadingHTTPServer, GzipHandler, _resolve_port, STORE_DIR
from mcp_server import MCPServer

TEST_PORT = 18095

class TestMCPServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', TEST_PORT), GzipHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def test_mcp_initialize_and_tools(self):
        url = f'http://127.0.0.1:{TEST_PORT}/mcp/messages'
        req_data = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'initialize',
            'params': {}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(req_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode('utf-8'))
            self.assertIn('result', res)
            self.assertEqual(res['result']['protocolVersion'], '2024-11-05')

        # Test tools/list
        req_data = {
            'jsonrpc': '2.0',
            'id': 2,
            'method': 'tools/list',
            'params': {}
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(req_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode('utf-8'))
            tools = res['result']['tools']
            tool_names = [t['name'] for t in tools]
            self.assertIn('get_active_mindmap', tool_names)
            self.assertIn('list_mindmaps', tool_names)
            self.assertIn('audit_mindmap_logic', tool_names)
            self.assertIn('generate_socratic_quiz', tool_names)

        # Test call get_active_mindmap
        req_data = {
            'jsonrpc': '2.0',
            'id': 3,
            'method': 'tools/call',
            'params': {
                'name': 'get_active_mindmap',
                'arguments': {}
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(req_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            res = json.loads(resp.read().decode('utf-8'))
            content = res['result']['content'][0]['text']
            self.assertTrue(len(content) > 0)
            self.assertIn('思维导图', content)

if __name__ == '__main__':
    unittest.main()
