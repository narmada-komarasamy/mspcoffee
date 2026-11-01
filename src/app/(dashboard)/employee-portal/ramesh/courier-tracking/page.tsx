import Link from 'next/link';
export default function CourierTrackingPage() {
  return <><div style={{display:'flex',justifyContent:'flex-end',padding:'12px 24px'}}><Link href="/user-guides/courier-tracking" style={{color:'var(--t-text)',textDecoration:'underline'}}>How to use this page →</Link></div><iframe title="Courier and Tracking" src="/courier-app.html" style={{width:'100%',height:'calc(100dvh - 145px)',minHeight:700,border:0,background:'var(--t-bg)'}} /></>;
}
