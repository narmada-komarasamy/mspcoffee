import AppKit
import CoreText
import ImageIO
let W:CGFloat=595.28,H:CGFloat=841.89
let green=NSColor(calibratedRed:0.14,green:0.29,blue:0.20,alpha:1)
let ink=NSColor(calibratedRed:0.13,green:0.15,blue:0.13,alpha:1)
let muted=NSColor(calibratedRed:0.35,green:0.39,blue:0.34,alpha:1)
let tamil=NSFont(name:"TamilSangamMN",size:10.5)!
let root=URL(fileURLWithPath:CommandLine.arguments[0]).deletingLastPathComponent().path
let assets=root+"/assets/"
func text(_ s:String,_ ctx:CGContext,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat,_ size:CGFloat=10.5,_ bold:Bool=false,_ color:NSColor=ink,_ ta:Bool=false)->CGFloat{
 let font=ta ? NSFont(descriptor:tamil.fontDescriptor,size:size)! : NSFont(name:bold ? "Arial-BoldMT":"ArialMT",size:size)!
 let para=NSMutableParagraphStyle();para.lineSpacing=2.2
 let a=NSAttributedString(string:s,attributes:[.font:font,.foregroundColor:color,.paragraphStyle:para])
 let setter=CTFramesetterCreateWithAttributedString(a)
 let measured=CTFramesetterSuggestFrameSizeWithConstraints(setter,CFRangeMake(0,a.length),nil,CGSize(width:width,height:1000),nil)
 let height=ceil(measured.height)+4
 let frame=CTFramesetterCreateFrame(setter,CFRangeMake(0,a.length),CGPath(rect:CGRect(x:x,y:H-y-height,width:width,height:height),transform:nil),nil)
 if CTFrameGetVisibleStringRange(frame).length<a.length {fatalError("Text clipped: \(s)")}
 CTFrameDraw(frame,ctx);return height
}
func pair(_ en:String,_ ta:String,_ ctx:CGContext,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat,_ size:CGFloat=10.5)->CGFloat{
 let e=text(en,ctx,x,y,width,size);return e+text(ta,ctx,x,y+e+1,width,size,false,muted,true)+1
}
func step(_ num:String,_ title:String,_ en:String,_ ta:String,_ ctx:CGContext,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat)->CGFloat{
 let h=text(num+"  "+title,ctx,x,y,width,11.5,true,green)
 return h+pair(en,ta,ctx,x,y+h+2,width)+5
}
func image(_ file:String,_ ctx:CGContext,_ rect:CGRect){
 let im=NSImage(contentsOfFile:file)!;var original=CGRect(origin:.zero,size:im.size);let cg=im.cgImage(forProposedRect:&original,context:nil,hints:nil)!
 let ratio=min(rect.width/CGFloat(cg.width),rect.height/CGFloat(cg.height));let w=CGFloat(cg.width)*ratio,h=CGFloat(cg.height)*ratio;ctx.draw(cg,in:CGRect(x:rect.minX+(rect.width-w)/2,y:H-rect.minY-h,width:w,height:h))
}
let titles=["Record purchases and issues","Review and reconcile stock"]
let subtitles=["கொள்முதல் மற்றும் வழங்கல் பதிவு","பதிவுகளையும் இருப்பையும் சரிபார்க்கவும்"]
func header(_ p:Int,_ c:CGContext){
 image(root+"/../../msp-coffee-logo.png",c,CGRect(x:32,y:21,width:74,height:74))
 _=text("MSP COFFEE",c,119,32,430,18,true,green)
 _=text("HO FUEL  |  ENGLISH + தமிழ்",c,119,56,430,9,false,muted)
 _=text("STAFF USER GUIDE",c,119,74,430,8,true,green)
 _=text(titles[p-1],c,38,108,520,22,true)
 _=text(subtitles[p-1],c,38,139,520,13,false,green,true)
}
func footer(_ p:Int,_ c:CGContext){
 c.setStrokeColor(green.withAlphaComponent(0.3).cgColor);c.setLineWidth(0.6);c.move(to:CGPoint(x:38,y:46));c.addLine(to:CGPoint(x:557,y:46));c.strokePath()
 _=text("www.mspcoffee.com | Internal operations guide",c,38,805,350,8,false,muted)
 _=text("09 Nov 2026 · v1.0 · \(p) / 2",c,385,805,180,8,false,muted)
}
func capture(_ name:String,_ c:CGContext,_ y:CGFloat,_ height:CGFloat,_ crop:CGRect){
 let im=NSImage(contentsOfFile:assets+name+".png")!;var r=CGRect(origin:.zero,size:im.size)
 let cg=im.cgImage(forProposedRect:&r,context:nil,hints:nil)!
 let part=cg.cropping(to:crop)!
 c.draw(part,in:CGRect(x:38,y:H-y-height,width:520,height:height))
}
let output=root+"/../../MSP_Coffee_HO_Fuel_Guide.pdf"
var box=CGRect(x:0,y:0,width:W,height:H)
let c=CGContext(URL(fileURLWithPath:output) as CFURL,mediaBox:&box,nil)!
for page in 1...2 {
 c.beginPDFPage(nil);c.setFillColor(NSColor(calibratedRed:250/255,green:246/255,blue:236/255,alpha:1).cgColor);c.fill(box);header(page,c)
 var y:CGFloat=170
 if page==1 {
 y += pair("For authorised HO fuel staff. Purchases add to store stock; issues reduce it. Keep the source bill or issue note.","அனுமதி பெற்ற HO எரிபொருள் பணியாளர்களுக்கான வழிகாட்டி. கொள்முதல் இருப்பைக் கூட்டும்; வழங்கல் இருப்பைக் குறைக்கும். பில் அல்லது வழங்கல் குறிப்பை வைத்திருக்கவும்.",c,38,y,520)
 capture("entry",c,y+4,190,CGRect(x:30,y:485,width:2140,height:900));y += 203
 y += text("Actual entry controls with blank data; examples in fields are placeholders.",c,38,y,520,8.5,false,muted)+5
 y += step("1","Open HO Fuel and check for duplicates","Sign in, select HO Fuel, and check Transaction Log for the date, fuel, quantity and vehicle. If already saved, do not enter it again. Open Log Fuel Entry for a new transaction.","உள்நுழைந்து HO Fuel தேர்ந்தெடுக்கவும். Transaction Log இல் தேதி, எரிபொருள், அளவு, வாகனத்தைச் சரிபார்க்கவும். ஏற்கனவே இருந்தால் மீண்டும் பதிவு செய்ய வேண்டாம். புதிய பதிவுக்கு Log Fuel Entry திறக்கவும்.",c,38,y,520)
 y += step("2","Save a purchase into store","In LOG FUEL PURCHASE, enter Date, Fuel Type, Supplier / Source and Quantity (Litres). Enter the bill's Total Cost (₹), not the price per litre. Add payment mode and remarks; click Save Purchase.","LOG FUEL PURCHASE இல் Date, Fuel Type, Supplier / Source, Quantity (Litres) நிரப்பவும். Total Cost (₹) இல் பில்லின் மொத்தத் தொகையை எழுதவும்; ஒரு லிட்டர் விலை அல்ல. கட்டண முறை, குறிப்புகளைச் சேர்த்து Save Purchase அழுத்தவும்.",c,38,y,520)
 y += step("3","Save an issue from store","In LOG FUEL ISSUE, enter Date, Fuel Type, Vehicle / Equipment, Estate and Quantity (Litres). Add Vehicle Name, Received By and Remarks where known. Source stays HO STORE. Click Save Issue.","LOG FUEL ISSUE இல் Date, Fuel Type, Vehicle / Equipment, Estate, Quantity (Litres) நிரப்பவும். தெரிந்தால் Vehicle Name, Received By, Remarks சேர்க்கவும். Source என்பது HO STORE. Save Issue அழுத்தவும்.",c,38,y,520)
 y += step("4","Confirm the saved entry","Wait for the success message, then check Transaction Log. If unsure, refresh and check before saving again. Clear Session Count resets only the counter; it does not delete saved entries.","வெற்றிச் செய்தி வந்ததும் Transaction Log இல் சரிபார்க்கவும். சந்தேகம் இருந்தால் மீண்டும் சேமிப்பதற்கு முன் புதுப்பித்துப் பார்க்கவும். Clear Session Count எண்ணிக்கையை மட்டும் மாற்றும்; சேமித்த பதிவுகளை நீக்காது.",c,38,y,520)
 } else {
 capture("overview",c,170,130,CGRect(x:30,y:185,width:2140,height:535))
 _=text("Overview - blank demonstration; displayed zeros are not actual stock.",c,38,304,520,8.5,false,muted)
 capture("log",c,325,87,CGRect(x:30,y:315,width:2140,height:360))
 _=text("Transaction Log - filter controls and Export CSV; blank demonstration.",c,38,415,520,8.5,false,muted)
 y=439
 y += step("5","Review consumers and export the log","Consumers shows issues by estate and vehicle/equipment. Set Month, Fuel Type, Estate, Year and Consumer as needed. In Transaction Log, use Type, Fuel, Month, Vehicle / Equipment, Estate or Search. Export CSV downloads the filtered entries.","Consumers இல் எஸ்டேட், வாகன வழங்கலைப் பார்க்கலாம். Month, Fuel Type, Estate, Year, Consumer தேர்ந்தெடுக்கவும். Transaction Log இல் Type, Fuel, Month, Vehicle / Equipment, Estate, Search மூலம் தேடவும். Export CSV வடிகட்டிய பதிவுகளைத் தரும்.",c,38,y,520)
 y += step("6","Compare physical stock with Overview","Check Diesel in Store and Petrol in Store separately: recorded purchases minus recorded issues through today, India time. Count physical stock at the same time and compare in litres. Opening stock is not recorded separately. Future-dated entries are excluded; review their dates in Transaction Log.","Overview இல் Diesel in Store, Petrol in Store தனித்தனியாகப் பார்க்கவும்: இந்திய நேரப்படி இன்று வரை கொள்முதல் கழித்த வழங்கல். அதே நேரத்தில் உண்மையான இருப்பை லிட்டரில் அளந்து ஒப்பிடவும். தொடக்க இருப்பு தனியாகப் பதிவாகவில்லை. எதிர்காலத் தேதி பதிவுகள் கணக்கில் சேராது; Transaction Log இல் தேதியைச் சரிபார்க்கவும்.",c,38,y,520)
 y += step("7","Report differences and errors","Use positive quantities and actual dates; future dates are blocked. If stock differs, report fuel type, physical litres, displayed litres and count time to the administrator with supporting records. Ask the administrator to correct existing records; do not add a balancing or duplicate entry. For a load error, click Retry.","நேர்மறை அளவு, உண்மையான தேதியைப் பயன்படுத்தவும்; எதிர்காலத் தேதி ஏற்கப்படாது. வேறுபாடு இருந்தால் எரிபொருள் வகை, உண்மையான மற்றும் காட்டப்படும் லிட்டர், அளந்த நேரம், ஆதாரங்களை நிர்வாகியிடம் தெரிவிக்கவும். பழைய பதிவைத் திருத்தக் கோரவும்; சமன்படுத்த அல்லது நகல் பதிவு சேர்க்க வேண்டாம். ஏற்றப் பிழைக்கு Retry அழுத்தவும்.",c,38,y,520)
 }
 print("Page \(page) ends at \(y)")
 if y>787 {fatalError("Page \(page) overflow: \(y)")}
 footer(page,c);c.endPDFPage()
}
c.closePDF()
let doc=CGPDFDocument(URL(fileURLWithPath:output) as CFURL)!
assert(doc.numberOfPages==2)
for page in 1...2 {
 let bitmap=CGContext(data:nil,width:1190,height:1684,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 bitmap.scaleBy(x:2,y:2);bitmap.drawPDFPage(doc.page(at:page)!)
 let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:root+"/../../ho-fuel-guide-page-\(page).png") as CFURL,"public.png" as CFString,1,nil)!
 CGImageDestinationAddImage(dest,bitmap.makeImage()!,nil);CGImageDestinationFinalize(dest)
}
print("Created \(output)")
