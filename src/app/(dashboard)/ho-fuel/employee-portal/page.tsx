"use client";

import { Users } from "lucide-react";

export default function EmployeePortalPage() {
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <Users className="h-8 w-8 text-emerald-700" />
 <h1 className="text-3xl font-serif text-emerald-800">Employee Portal</h1>
 </div>
 <p className="text-stone-600">
 Employee information and tools will appear here.
 </p>
 </div>
 );
}
