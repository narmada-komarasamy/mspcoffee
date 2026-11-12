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
let titles=["Upload bills and record fuel","Review records and stock"]
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
 _=text("12 Nov 2026 · v1.1 · \(p) / 2",c,385,805,180,8,false,muted)
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
 y += pair("Bills are required for new purchases. Use DD/MM/YYYY dates and the total bill cost.","புதிய கொள்முதலுக்கு பில் அவசியம். தேதியை DD/MM/YYYY முறையிலும் பில்லின் மொத்தத் தொகையையும் பதிவு செய்யவும்.",c,38,y,520)
 // Exact control names and approved colours; a button key, not a screenshot.
 let keyY=y+5
 c.setFillColor(NSColor(calibratedRed:74/255,green:158/255,blue:74/255,alpha:1).cgColor)
 c.addPath(CGPath(roundedRect:CGRect(x:38,y:H-keyY-31,width:145,height:31),cornerWidth:6,cornerHeight:6,transform:nil));c.fillPath()
 _=text("Upload Bill",c,54,keyY+7,125,11.5,true,.white)
 c.setFillColor(NSColor(calibratedRed:244/255,green:239/255,blue:221/255,alpha:1).cgColor)
 c.addPath(CGPath(roundedRect:CGRect(x:193,y:H-keyY-31,width:246,height:31),cornerWidth:6,cornerHeight:6,transform:nil));c.fillPath()
 _=text("Read bill and fill details",c,205,keyY+7,226,11,true,muted)
 y=keyY+36
 y += text("Button key: green opens file selection; cream reads uploaded bills again.",c,38,y,520,8.5,false,muted)+8
 y += step("1","Open the page and avoid duplicates","Sign in → HO Fuel → Transaction Log. Check whether the purchase or issue already exists. For a new record, open Log Fuel Entry.","உள்நுழைந்து HO Fuel → Transaction Log திறக்கவும். கொள்முதல் அல்லது வழங்கல் ஏற்கனவே உள்ளதா பார்க்கவும். புதிய பதிவுக்கு Log Fuel Entry திறக்கவும்.",c,38,y,520)
 y += step("2","Upload the purchase bill","Click green Upload Bill. Attach all pages of ONE purchase: PDF, JPG, PNG or WebP; up to 10 files, 3 MB each. The bill is read automatically.","பச்சை Upload Bill அழுத்தவும். ஒரே கொள்முதலின் அனைத்துப் பக்கங்களையும் தேர்ந்தெடுக்கவும்: PDF, JPG, PNG அல்லது WebP; அதிகபட்சம் 10 கோப்புகள், ஒவ்வொன்றும் 3 MB. பில் தானாக வாசிக்கப்படும்.",c,38,y,520)
 y += step("3","Review the extracted details","Check Date, Fuel Type, Supplier / Source, Quantity (Litres) and Total Cost (₹) against the bill. Total Cost is the full bill amount, not the price per litre. Correct unclear fields manually. Read bill and fill details retries reading. Future dates are blocked.","பில்லுடன் Date, Fuel Type, Supplier / Source, Quantity (Litres), Total Cost (₹) ஒப்பிடவும். Total Cost என்பது மொத்த பில் தொகை; ஒரு லிட்டர் விலை அல்ல. தெளிவில்லாத தகவலை கைமுறையாகச் சரிசெய்யவும். மீண்டும் வாசிக்க Read bill and fill details அழுத்தவும். எதிர்காலத் தேதி ஏற்கப்படாது.",c,38,y,520)
 y += step("4","Confirm and save the purchase","Add payment mode and remarks if needed. Tick the confirmation only after checking the bill, then click Save Purchase. Wait for success and verify Transaction Log before trying again. A new purchase cannot be saved without a bill.","தேவையெனில் கட்டண முறை, குறிப்புகளைச் சேர்க்கவும். பில்லைச் சரிபார்த்த பிறகு உறுதிப்படுத்தும் பெட்டியைத் தேர்ந்தெடுத்து Save Purchase அழுத்தவும். வெற்றிச் செய்திக்குப் பிறகு Transaction Log பார்க்கவும். பில் இல்லாமல் புதிய கொள்முதலைச் சேமிக்க முடியாது.",c,38,y,520)
 y += step("5","Record fuel issued from store","Use LOG FUEL ISSUE: Date, Fuel Type, Vehicle / Equipment, Estate and Quantity (Litres) are required. Add Received By; click Save Issue and check the log.","LOG FUEL ISSUE இல் Date, Fuel Type, Vehicle / Equipment, Estate, Quantity (Litres) நிரப்பவும். Received By சேர்த்து Save Issue அழுத்தவும்; பதிவைச் சரிபார்க்கவும்.",c,38,y,520)
 } else {
 capture("overview",c,170,130,CGRect(x:30,y:185,width:2140,height:535))
 _=text("Overview controls: retained blank-screen example; zeros are not actual stock.",c,38,304,520,8.5,false,muted)
 y=328
 y += step("6","Find entries, open bills and export","In Transaction Log, filter by Type, Fuel, Month, Vehicle / Equipment or Estate, or use Search. On a purchase, open Bills / Upload bill to view saved files or add missing pages to an existing purchase. Do not create another purchase just to attach its bill. Export CSV downloads only the filtered entries.","Transaction Log இல் Type, Fuel, Month, Vehicle / Equipment, Estate அல்லது Search மூலம் தேடவும். கொள்முதலில் Bills / Upload bill திறந்து பில்களைப் பார்க்கவும் அல்லது விடுபட்ட பக்கங்களைச் சேர்க்கவும். பில் இணைப்பதற்காக புதிய கொள்முதல் பதிவு செய்ய வேண்டாம். Export CSV வடிகட்டிய பதிவுகளை மட்டும் தரும்.",c,38,y,520)
 y += step("7","Review Consumers","Consumers shows fuel issued by estate and vehicle/equipment. Use Month, Fuel Type, Estate, Year and Consumer filters to review usage.","Consumers இல் எஸ்டேட், வாகனம் அல்லது உபகரணத்திற்கு வழங்கிய எரிபொருளைப் பார்க்கலாம். Month, Fuel Type, Estate, Year, Consumer வடிகட்டிகளைப் பயன்படுத்தவும்.",c,38,y,520)
 y += step("8","Reconcile Overview with physical stock","Check Diesel in Store and Petrol in Store separately. Balance = recorded purchases minus recorded issues through today (India time); opening stock is not recorded separately. Future-dated entries are excluded. Compare with physical litres measured at the same time; the displayed balance is not a physical-stock confirmation.","Diesel in Store, Petrol in Store தனித்தனியாகப் பார்க்கவும். இந்திய நேரப்படி இன்று வரையிலான கொள்முதல் கழித்த வழங்கல் இருப்பாகும்; தொடக்க இருப்பு தனியாகப் பதிவாகவில்லை. எதிர்காலத் தேதிகள் கணக்கில் சேராது. அதே நேரத்தில் அளந்த உண்மையான லிட்டருடன் ஒப்பிடவும்; திரையில் உள்ள இருப்பு உண்மையான இருப்பை உறுதி செய்யாது.",c,38,y,520)
 y += step("9","Handle errors and report differences","If reading fails, keep the bill attached and enter its details manually. If saving is uncertain, check the log before retrying. Report fuel type, physical and displayed litres, count time and supporting records to the administrator. Do not add a balancing or duplicate entry. Clear Session Count only resets the counter.","பில் வாசிக்கப்படாவிட்டால் இணைப்பை வைத்துக் கொண்டு விவரங்களைக் கைமுறையாக நிரப்பவும். சேமிப்பு உறுதியில்லையெனில் மீண்டும் முயற்சிக்கும் முன் பதிவைப் பார்க்கவும். எரிபொருள் வகை, உண்மையான மற்றும் காட்டப்படும் லிட்டர், அளந்த நேரம், ஆதாரங்களை நிர்வாகியிடம் தெரிவிக்கவும். சமன்படுத்த அல்லது நகல் பதிவு சேர்க்க வேண்டாம். Clear Session Count எண்ணிக்கையை மட்டும் மாற்றும்.",c,38,y,520)
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
