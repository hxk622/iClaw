import { ChevronRight, Cloud, Code, MoreHorizontal, Sparkles, Wand2 } from 'lucide-react';

export function Sidebar() {
  const menuItems = [
    { icon: Sparkles, label: 'AI 浏览器', hasArrow: true },
    { icon: Code, label: '应用生成', hasArrow: true },
    { icon: Wand2, label: 'AI 创作' },
    { icon: Cloud, label: '云盘', hasArrow: true },
    { icon: MoreHorizontal, label: '更多' },
  ];

  return (
    <div className="flex h-screen w-[246px] flex-col bg-[#f7f7f7]">
      <div className="px-4 pt-5 pb-4">
        <div className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-sm font-medium text-white">
            i
          </div>
          <span className="text-[15px] text-[#1f1f1f]">iClaw</span>
        </div>
      </div>

      <div className="space-y-1 px-4">
        {menuItems.map((item) => (
          <div
            key={item.label}
            className="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/50"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-[#1f1f1f]" />
              <span className="text-[14px] text-[#1f1f1f]">{item.label}</span>
            </div>
            {item.hasArrow && (
              <ChevronRight className="h-4 w-4 text-[#8f8f8f] opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </div>
        ))}
      </div>

      <div className="mx-4 my-4 h-px bg-[#e5e5e5]" />

      <div className="flex-1 overflow-y-auto px-4">
        <div className="rounded-lg px-3 py-2.5 text-[14px] text-[#646464]">v0 仅实现基础对话</div>
      </div>

      <div className="border-t border-[#e5e5e5] px-4 py-2.5">
        <div className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-sm font-medium text-white">
            i
          </div>
          <div className="flex-1">
            <div className="text-[13px] text-[#1f1f1f]">iClaw User</div>
            <div className="text-[11px] text-[#8f8f8f]">v0 preview</div>
          </div>
        </div>
      </div>
    </div>
  );
}
