with open("src/app/(dashboard)/rainfall/page.tsx", "r") as f:
 lines = f.readlines()

fixed = []
for i, line in enumerate(lines):
 if i >= 816 and i <= 830:
 stripped = line.strip()
 needs_fix = (stripped.startswith("<div") or stripped.startswith("</div") or
 stripped.startswith("{up") or stripped.startswith("{pct") or
 stripped.startswith("{year") or stripped.startswith("{prior") or
 stripped.startswith("{current") or stripped.startswith("{Math"))
 if needs_fix and not stripped.startswith("</div>"):
 fixed.append(" " + stripped + "\n")
 else:
 fixed.append(line)
 else:
 fixed.append(line)

with open("src/app/(dashboard)/rainfall/page.tsx", "w") as f:
 f.writelines(fixed)
print("Fixed indentation for YoY cards")
