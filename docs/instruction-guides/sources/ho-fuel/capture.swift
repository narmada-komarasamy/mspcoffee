import AppKit
import WebKit
let root=URL(fileURLWithPath:CommandLine.arguments[0]).deletingLastPathComponent()
let app=NSApplication.shared
class Capture:NSObject,WKNavigationDelegate {
 let web:WKWebView
 var names=["overview","entry","log","consumers"]
 init(_ web:WKWebView){self.web=web;super.init();web.navigationDelegate=self}
 func next(){if names.isEmpty{exit(0)};let name=names[0];web.loadFileURL(root.appendingPathComponent(name+".html"),allowingReadAccessTo:root)}
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){
 DispatchQueue.main.asyncAfter(deadline:.now()+0.4){
 let cfg=WKSnapshotConfiguration();cfg.rect=CGRect(x:0,y:0,width:1100,height:self.names[0]=="entry" ? 960 : self.names[0]=="overview" ? 370 : 450)
 self.web.takeSnapshot(with:cfg){im,err in
 guard let im=im,let tiff=im.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),let png=bitmap.representation(using:.png,properties:[:]) else{fatalError("Snapshot failed \(String(describing:err))")}
 try! png.write(to:root.appendingPathComponent("assets/"+self.names.removeFirst()+".png"));self.next()
 }
 }
 }
}
let web=WKWebView(frame:CGRect(x:0,y:0,width:1100,height:1100))
let capture=Capture(web);capture.next();app.run()
