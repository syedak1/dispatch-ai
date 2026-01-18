import { useState } from 'react';

interface TestResult {
  url: string;
  status: 'testing' | 'success' | 'error' | 'timeout';
  message: string;
  responseTime?: number;
}

export default function ConnectionTest() {
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testUrls = [
    { name: 'HTTP Health Check', url: import.meta.env.VITE_WS_URL?.replace('ws', 'http')?.replace('wss', 'https') + '/health' },
    { name: 'HTTP Root', url: import.meta.env.VITE_WS_URL?.replace('ws', 'http')?.replace('wss', 'https') + '/' },
    { name: 'WebSocket Dispatcher', url: import.meta.env.VITE_WS_URL + '/ws/dispatcher' },
  ];

  const testConnection = async (url: string, type: 'http' | 'ws'): Promise<TestResult> => {
    const startTime = Date.now();

    try {
      if (type === 'http') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          return {
            url,
            status: 'success',
            message: `✅ ${response.status} - ${JSON.stringify(data)}`,
            responseTime
          };
        } else {
          return {
            url,
            status: 'error',
            message: `❌ ${response.status} ${response.statusText}`,
            responseTime
          };
        }
      } else {
        // WebSocket test
        return new Promise((resolve) => {
          const ws = new WebSocket(url);
          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              url,
              status: 'timeout',
              message: '⏰ Connection timeout after 5s'
            });
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            const responseTime = Date.now() - startTime;
            ws.close();
            resolve({
              url,
              status: 'success',
              message: '✅ WebSocket connected successfully',
              responseTime
            });
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            resolve({
              url,
              status: 'error',
              message: `❌ WebSocket connection failed: ${error}`
            });
          };

          ws.onclose = (event) => {
            if (event.code !== 1000) { // Not a normal closure
              clearTimeout(timeout);
              resolve({
                url,
                status: 'error',
                message: `❌ WebSocket closed: ${event.code} ${event.reason}`
              });
            }
          };
        });
      }
    } catch (error) {
      return {
        url,
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  };

  const runAllTests = async () => {
    setIsTesting(true);
    setTestResults([]);

    const results: TestResult[] = [];

    // Test HTTP endpoints first
    for (const test of testUrls.filter(t => !t.url.includes('ws'))) {
      const result = await testConnection(test.url, 'http');
      results.push(result);
      setTestResults([...results]);
    }

    // Test WebSocket
    const wsTest = testUrls.find(t => t.url.includes('ws'));
    if (wsTest) {
      const result = await testConnection(wsTest.url, 'ws');
      results.push(result);
      setTestResults([...results]);
    }

    setIsTesting(false);
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'timeout': return 'text-yellow-400';
      case 'testing': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!showTest ? (
        <button
          onClick={() => setShowTest(true)}
          className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          🔧 Debug Connection
        </button>
      ) : (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-96 max-h-96 overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Connection Diagnostic</h3>
            <button
              onClick={() => setShowTest(false)}
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-400 mb-1">WebSocket URL:</p>
            <code className="text-xs text-blue-400 break-all">
              {import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}
            </code>
          </div>

          <button
            onClick={runAllTests}
            disabled={isTesting}
            className="w-full mb-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            {isTesting ? 'Testing...' : 'Run Connection Tests'}
          </button>

          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-zinc-300">
                    {testUrls.find(t => t.url === result.url)?.name || result.url}
                  </span>
                  {result.responseTime && (
                    <span className="text-xs text-zinc-500">
                      {result.responseTime}ms
                    </span>
                  )}
                </div>
                <p className={`text-sm ${getStatusColor(result.status)}`}>
                  {result.message}
                </p>
              </div>
            ))}
          </div>

          {testResults.length > 0 && (
            <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
              <h4 className="text-sm font-semibold text-zinc-300 mb-2">Troubleshooting Tips:</h4>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• Check if Railway app is deployed and running</li>
                <li>• Verify VITE_WS_URL environment variable in Vercel</li>
                <li>• Ensure Railway allows WebSocket connections</li>
                <li>• Check Railway logs for backend errors</li>
                <li>• Try using wss:// instead of ws:// for HTTPS sites</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}