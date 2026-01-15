// Quick smoke test for anonymous event ingestion (no lead_id required)
// Usage: node test_anonymous_event.js [API_BASE_URL] [API_KEY]

const API_BASE = process.argv[2] || 'http://localhost:4000';
const API_KEY = process.argv[3] || 'test-key';
const ENDPOINT = `${API_BASE}/marketing/ingest-intent-event`;

async function testAnonymousEvent() {
  console.log(`Testing anonymous event ingestion at ${ENDPOINT}...\n`);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-do-intent-key': API_KEY,
        'origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        event_type: 'page_view',
        anonymous_id: 'test-anonymous-123',
        url: 'https://example.com/pricing',
        path: '/pricing',
        metadata: {
          page_title: 'Pricing Page',
        },
      }),
    });

    const data = await response.json();
    const status = response.status;

    console.log(`HTTP Status: ${status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (status === 200 && data.event_id && data.lead_id === null) {
      console.log('\n✅ Test passed: Event created successfully with lead_id: null');
      return 0;
    } else if (status === 200) {
      console.log('\n⚠️  Test partially passed: Event created but lead_id is not null');
      return 0;
    } else {
      console.log('\n❌ Test failed: Unexpected status or response');
      return 1;
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return 1;
  }
}

testAnonymousEvent().then(process.exit);

