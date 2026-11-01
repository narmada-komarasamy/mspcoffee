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
 return h+pair(en,ta,ctx,x,y+h+2,width)+8
}
func image(_ file:String,_ ctx:CGContext,_ rect:CGRect){
 let im=NSImage(contentsOfFile:file)!;var original=CGRect(origin:.zero,size:im.size);let cg=im.cgImage(forProposedRect:&original,context:nil,hints:nil)!
 let ratio=min(rect.width/CGFloat(cg.width),rect.height/CGFloat(cg.height));let w=CGFloat(cg.width)*ratio,h=CGFloat(cg.height)*ratio;ctx.draw(cg,in:CGRect(x:rect.minX+(rect.width-w)/2,y:H-rect.minY-h,width:w,height:h))
}
let titles=["Record fuel and kilometres","Use photos, then review","Maintenance and insurance","Find bills and prepare reports"]
let subtitles=["எரிபொருள் மற்றும் கிலோமீட்டர் பதிவு","படங்களைப் பயன்படுத்தி சரிபார்க்கவும்","பராமரிப்பு மற்றும் காப்பீடு","பில்கள் மற்றும் அறிக்கைகளைப் பெறுங்கள்"]
func header(_ p:Int,_ c:CGContext){
 image(root+"/../../msp-coffee-logo.png",c,CGRect(x:32,y:21,width:74,height:74))
 _=text("MSP COFFEE",c,119,32,430,18,true,green)
 _=text("FLEET FUEL EXPENSES  |  ENGLISH + தமிழ்",c,119,56,430,9,false,muted)
 _=text("STAFF USER GUIDE",c,119,74,430,8,true,green)
 _=text(titles[p-1],c,38,108,520,22,true)
 _=text(subtitles[p-1],c,38,139,520,13,false,green,true)
}
func footer(_ p:Int,_ c:CGContext){
 c.setStrokeColor(green.withAlphaComponent(0.3).cgColor);c.setLineWidth(0.6);c.move(to:CGPoint(x:38,y:46));c.addLine(to:CGPoint(x:557,y:46));c.strokePath()
 _=text("www.mspcoffee.com | Internal operations guide",c,38,805,350,8,false,muted)
 _=text("01 Nov 2026 · v1.0 · \(p) / 4",c,385,805,180,8,false,muted)
}
func caption(_ s:String,_ c:CGContext,_ y:CGFloat){_=text(s,c,38,y,520,8.5,false,muted)}
func note(_ en:String,_ ta:String,_ c:CGContext,_ y:CGFloat)->CGFloat{
 return pair(en,ta,c,38,y,520,9.5)
}
let output=root+"/../../MSP_Coffee_Fleet_Fuel_Guide.pdf"
var box=CGRect(x:0,y:0,width:W,height:H)
let c=CGContext(URL(fileURLWithPath:output) as CFURL,mediaBox:&box,nil)!
for page in 1...4 {
 c.beginPDFPage(nil);c.setFillColor(NSColor(calibratedRed:0.98,green:0.965,blue:0.925,alpha:1).cgColor);c.fill(box);header(page,c)
 var y:CGFloat=0
 if page==1 {
  _=pair("For authorised staff. Record expenses promptly. Keep clear originals and check the log before adding anything.","அனுமதி பெற்ற பணியாளர்களுக்கான வழிகாட்டி. செலவுகளை உடனே பதிவு செய்யவும். தெளிவான அசல் ரசீதுகளை வைத்திருந்து, புதிய பதிவுக்கு முன் பழைய பதிவுகளைச் சரிபார்க்கவும்.",c,38,170,520,10)
  image(assets+"msp-fleet-record-fields.png",c,CGRect(x:38,y:224,width:520,height:170))
  caption("Screen 1 | Add Record - blank entry fields; check the date format shown on your device.",c,397)
  y=420
  y += step("1","Open the page and check for an existing entry","Sign in and select Fleet Fuel Expenses. Click View daily log; filter by vehicle and date. If the expense is already there, use its pencil Edit button. Agree who will enter it so two people do not save the same expense.","உள்நுழைந்து Fleet Fuel Expenses தேர்ந்தெடுக்கவும். View daily log மூலம் வாகனம் மற்றும் தேதியைத் தேர்ந்தெடுத்து தேடவும். ஏற்கனவே இருந்தால் pencil Edit பொத்தானைப் பயன்படுத்தவும். ஒரே செலவை இருவர் பதிவு செய்யாமல் யார் பதிவு செய்வது என்பதை முடிவு செய்யவும்.",c,38,y,520)
  y += step("2","Enter the vehicle, date and readings","Click Add Record. Set Vehicle Log Date, Vehicle ID, Vehicle Type, Account and Fuel Type. Use the existing full vehicle number. Check Starting KM against the earlier Closing KM; enter it manually if absent. Enter the actual Closing KM; never invent readings for a maintenance-only entry.","Add Record அழுத்தி Vehicle Log Date, Vehicle ID, Vehicle Type, Account, Fuel Type ஆகியவற்றை நிரப்பவும். ஏற்கனவே உள்ள முழு வாகன எண்ணைப் பயன்படுத்தவும். முந்தைய Closing KM உடன் Starting KM சரிபார்க்கவும்; இல்லாவிட்டால் உள்ளிடவும். உண்மையான Closing KM மட்டும் எழுதவும். பராமரிப்புக்கு கற்பனையான KM எழுத வேண்டாம்.",c,38,y,520)
  y += step("3","Check fuel amounts, save and verify","Enter Fuel Filled (L) and Fuel Cost (₹) from the receipt. KM Run and Total Cost calculate automatically. Add Remarks for exceptions; click Add record (or Save changes when editing). Check the highlighted saved row in the Daily Vehicle Log. If unsure whether a save worked, refresh and check before retrying.","ரசீதிலிருந்து Fuel Filled (L), Fuel Cost (₹) உள்ளிடவும். KM Run, Total Cost தானாகக் கணக்கிடப்படும். விதிவிலக்குகளை Remarks இல் எழுதவும். Add record அல்லது திருத்தும்போது Save changes அழுத்தவும். Daily Vehicle Log இல் சேமித்த பதிவைச் சரிபார்க்கவும். சேமிப்பு சந்தேகமாக இருந்தால் மீண்டும் பதிவதற்கு முன் புதுப்பித்துப் பார்க்கவும்.",c,38,y,520)
 } else if page==2 {
  _=pair("Use Add from Photos for a fuel entry. Use Add Record for maintenance-only or insurance-only expenses.","எரிபொருள் பதிவிற்கு Add from Photos பயன்படுத்தவும். பராமரிப்பு அல்லது காப்பீடு மட்டும் இருந்தால் Add Record பயன்படுத்தவும்.",c,38,170,520,10)
  image(assets+"msp-fleet-photos-blank.png",c,CGRect(x:38,y:218,width:520,height:145))
  caption("Screen 2 | Add from Photos - blank odometer and fuel receipt upload areas.",c,371)
  y=395
  y += step("4","Upload clear photos and extract","Click Add from Photos. Choose the Odometer Photo and Fuel Bill Photo, preferably both. Keep the entire receipt visible with date, litres and total readable; avoid glare. Use JPG, PNG or WebP; both photos together must be 3 MB or less. Click Extract details.","Add from Photos அழுத்தவும். Odometer Photo, Fuel Bill Photo இரண்டையும் முடிந்தவரை சேர்க்கவும். முழு ரசீது, தேதி, லிட்டர், மொத்தம் தெளிவாக இருக்க வேண்டும்; ஒளிப்பிரதிபலிப்பைத் தவிர்க்கவும். JPG, PNG, WebP படங்கள் இரண்டும் சேர்ந்து 3 MB க்குள் இருக்க வேண்டும். Extract details அழுத்தவும்.",c,38,y,520)
  y += step("5","Review every field and warning","Compare the extracted date, vehicle, account, fuel type, vendor, KM readings, litres and rupees with the originals. Correct errors and check Review Checks. Closing KM must exceed Starting KM and fuel litres must be positive. An existing vehicle/date record is never replaced here. Choose Attach photos only - keep saved amounts, or Open existing entry for review to correct it.","படங்களுடன் தேதி, வாகனம், கணக்கு, எரிபொருள் வகை, கடை, KM, லிட்டர், தொகையை ஒப்பிடவும். பிழைகளைத் திருத்தி Review Checks பார்க்கவும். Closing KM அதிகமாகவும் லிட்டர் பூஜ்ஜியத்தைவிட அதிகமாகவும் இருக்க வேண்டும். அதே வாகனம்/தேதி பதிவு இருந்தால் அது மாற்றப்படாது. தொகைகளை வைத்திருக்க Attach photos only - keep saved amounts; திருத்த Open existing entry for review தேர்ந்தெடுக்கவும்.",c,38,y,520)
  y += step("6","Save only after checking the original","When the values are correct, click Approve & update database. This button saves the entry; it is not a separate manager approval or payment. Verify the saved row. The original photos are saved privately with the entry. Use Fuel bill and Odometer photo in the daily log, or the saved evidence links in Edit, to reopen them.","விவரங்கள் சரியான பிறகு Approve & update database அழுத்தவும். இது பதிவைச் சேமிக்கும்; தனி மேலாளர் ஒப்புதலோ பணம் செலுத்துதலோ அல்ல. சேமித்த பதிவைச் சரிபார்க்கவும். அசல் படங்கள் பதிவுடன் தனிப்பட்ட முறையில் சேமிக்கப்படும். Daily log இல் Fuel bill, Odometer photo அல்லது Edit இல் உள்ள இணைப்புகள் மூலம் அவற்றை மீண்டும் பார்க்கலாம்.",c,38,y,520)
 } else if page==3 {
  _=pair("Keep every maintenance and insurance bill with its expense. Add an arriving bill to the existing entry whenever possible.","ஒவ்வொரு பராமரிப்பு மற்றும் காப்பீட்டுச் செலவுடனும் பில்லை இணைக்கவும். செலவு ஏற்கனவே இருந்தால் அதே பதிவில் பில்லைச் சேர்க்கவும்.",c,38,170,520,10)
  image(assets+"msp-fleet-maint-upload.png",c,CGRect(x:38,y:236,width:520,height:71))
  caption("Screen 3 | Upload Maintenance Bill - photo or PDF, up to 4 MB.",c,314)
  y=340
  y += step("7","Upload the bill to the correct record","Open the existing entry with Edit, or use Add Record for a new expense. Click Upload Maintenance Bill and choose a clear JPG, PNG, WebP or PDF up to 4 MB. Check the vehicle and log date, extracted Maint Cost (₹), Workshop / Vendor and Maintenance Performed. Existing non-zero maintenance cost is kept; correct it only after checking the original.","ஏற்கனவே உள்ள பதிவை Edit மூலம் திறக்கவும்; புதிய செலவிற்கு Add Record. Upload Maintenance Bill மூலம் தெளிவான JPG, PNG, WebP அல்லது PDF பில்லை 4 MB க்குள் சேர்க்கவும். வாகனம், பதிவு தேதி, Maint Cost (₹), Workshop / Vendor, Maintenance Performed சரிபார்க்கவும். பழைய செலவு பூஜ்ஜியம் இல்லாவிட்டால் அது நீடிக்கும்; அசலைப் பார்த்த பிறகே மாற்றவும்.",c,38,y,520)
  y += step("8","Record insurance under maintenance","For insurance, put the premium under Maint Cost (₹), describe it as Vehicle insurance premium and include insurer, policy reference and coverage dates in Remarks. Attach the policy or receipt. Do not put the premium under Fuel Cost or enter it twice. Review the separate Bill Date; if it differs from Vehicle Log Date, check both and confirm the on-screen date warning.","காப்பீட்டுத் தொகையை Maint Cost (₹) இல் பதிவு செய்து Vehicle insurance premium என விவரிக்கவும். காப்பீட்டு நிறுவனம், பாலிசி எண், காலத்தை Remarks இல் எழுதவும். பாலிசி அல்லது ரசீதை இணைக்கவும். Fuel Cost இல் அல்லது இருமுறை பதிவிட வேண்டாம். Bill Date, Vehicle Log Date வேறுபட்டால் இரண்டையும் சரிபார்த்து திரையில் உறுதிப்படுத்தவும்.",c,38,y,520)
  y += step("9","Resolve duplicates before saving","An exact previously uploaded bill is blocked: choose Open existing entry. For Possible duplicate expense, compare dates, amount and original bills. Choose Attach bill to this existing entry when offered. Confirm a genuinely separate expense only after checking; do not tick the checkbox just to continue. Save, then reopen View bill to verify the attachment. The Maintenance Cost card also opens bills.","ஏற்கனவே பதிவேற்றிய அதே பில் தடுக்கப்படும்; Open existing entry தேர்ந்தெடுக்கவும். Possible duplicate expense வந்தால் தேதி, தொகை, அசல் பில்களை ஒப்பிடவும். வாய்ப்பு இருந்தால் Attach bill to this existing entry தேர்ந்தெடுக்கவும். உண்மையில் தனிச் செலவு எனச் சரிபார்த்த பிறகே உறுதிப்படுத்தவும். தொடர்வதற்காக மட்டும் குறியிட வேண்டாம். சேமித்த பிறகு View bill மூலம் இணைப்பைப் பார்க்கவும். Maintenance Cost அட்டையிலும் பில்களைத் திறக்கலாம்.",c,38,y,520)
 } else {
  _=pair("Match the vehicle and period before comparing the log, dashboard and MIS Report.","பதிவுகள், dashboard, ஒருங்கிணைந்த செலவு அறிக்கையை ஒப்பிடும்போது ஒரே வாகனம் மற்றும் ஒரே காலத்தைத் தேர்ந்தெடுக்கவும்.",c,38,170,520,10)
  image(assets+"msp-fleet-log-search.png",c,CGRect(x:38,y:218,width:520,height:54))
  image(assets+"msp-fleet-log-dates.png",c,CGRect(x:38,y:278,width:520,height:45))
  caption("Screen 4 | Daily log filters - search, vehicle, period and CSV export.",c,328)
  image(assets+"msp-fleet-report-controls.png",c,CGRect(x:38,y:348,width:520,height:55))
  caption("Screen 5 | MIS Report - From/To month and year, Download CSV and Print.",c,408)
  y=430
  y += step("10","Search bills and correct saved entries","Click View daily log. Search maintenance bills for brake pads or insurance; select Vehicle and Year/Month or From Date/To Date. Use View bill for the original; pencil Edit and Save changes for corrections. Reset Filters if a row is missing.","View daily log இல் Search maintenance bills மூலம் brake pads அல்லது insurance தேடவும். Vehicle, Year/Month அல்லது From Date/To Date தேர்ந்தெடுக்கவும். View bill மூலம் அசலைப் பார்க்கவும்; pencil Edit, Save changes மூலம் திருத்தவும். பதிவு இல்லையெனில் Reset Filters.",c,38,y,520)
  y += step("11","Prepare the consolidated expense statement","Click MIS Report and set From/To month and year. Check each vehicle, KM, litres, Fuel Cost, Maint Cost and Total Cost; maintenance includes insurance. Choose Download CSV or Print. Daily-log CSV gives filtered detail. Share with the assigned reviewer; that person is still to be nominated.","MIS Report இல் From/To மாதம், ஆண்டு தேர்ந்தெடுக்கவும். வாகனம், KM, லிட்டர், Fuel Cost, Maint Cost, Total Cost சரிபார்க்கவும்; பராமரிப்பில் காப்பீடும் அடங்கும். Download CSV அல்லது Print பெறவும். Daily log CSV வடிகட்டிய விவரம் தரும். அறிக்கையை நியமிக்கப்படவுள்ள சரிபார்ப்பாளரிடம் வழங்கவும்.",c,38,y,520)
  y += step("12","Use Excel carefully and report problems","Use Upload Excel for up to 500 rows. Review the preview; use YYYY-MM-DD or Excel date cells. Import new rows only skips existing vehicle/date rows and keeps their bills. Check the actual saved/skipped counts and reasons. Use Edit for corrections; report errors to the administrator instead of adding another entry.","Upload Excel இல் அதிகபட்சம் 500 வரிகள். Preview சரிபார்த்து YYYY-MM-DD அல்லது Excel தேதி பயன்படுத்தவும். Import new rows only பழைய வாகனம்/தேதி பதிவுகளையும் பில்களையும் மாற்றாது. சேமித்த/தவிர்த்த எண்ணிக்கை, காரணங்களைப் பார்க்கவும். பழைய பதிவை Edit மூலம் திருத்தவும். பிழைகளை நிர்வாகியிடம் தெரிவிக்கவும்; மீண்டும் பதிவு செய்ய வேண்டாம்.",c,38,y,520)
 }
 print("Page \(page) ends at \(y)")
 if y>787 {fatalError("Page \(page) overflow: \(y)")}
 footer(page,c);c.endPDFPage()
}
c.closePDF()
let doc=CGPDFDocument(URL(fileURLWithPath:output) as CFURL)!
assert(doc.numberOfPages==4)
for page in 1...4 {
 let bitmap=CGContext(data:nil,width:1190,height:1684,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
 bitmap.scaleBy(x:2,y:2);bitmap.drawPDFPage(doc.page(at:page)!)
 let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:root+"/../../fleet-guide-page-\(page).png") as CFURL,"public.png" as CFString,1,nil)!
 CGImageDestinationAddImage(dest,bitmap.makeImage()!,nil);CGImageDestinationFinalize(dest)
}
print("Created \(output)")
