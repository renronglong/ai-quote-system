"use client";
import Link from "next/link";
import { HelpCircle } from "lucide-react";

export default function OperationGuide() {
  return (
    <div className="w-full">
      <Link
        href="/guide"
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200
          hover:from-blue-100 hover:to-indigo-100 transition-all shadow-sm"
      >
        <HelpCircle className="w-4 h-4" />
        <span>操作指南</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </Link>
    </div>
  );
}
