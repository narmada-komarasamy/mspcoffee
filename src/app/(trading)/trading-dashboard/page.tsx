export default function TradingDashboardPage() {
  return (
    <div style={{ margin: '-1.5rem', height: 'calc(100vh - 57px)' }}>
      <iframe
        src="/trading-dashboard.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="MSP Coffee — B2B Trading Hub"
      />
    </div>
  );
}
