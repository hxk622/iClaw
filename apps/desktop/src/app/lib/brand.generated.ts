export const BRAND = {
  "brandId": "iclaw",
  "productName": "iClaw",
  "displayName": "iClaw",
  "websiteTitle": "iClaw",
  "devWebsiteTitle": "iClaw-dev",
  "defaultThemeMode": "dark",
  "sidebarTitle": "iClaw",
  "devSidebarTitle": "iClaw-dev",
  "sidebarSubtitle": "",
  "legalName": "iClaw",
  "bundleIdentifier": "ai.iclaw.desktop",
  "authService": "ai.iclaw.desktop",
  "assets": {
    "faviconIcoSrc": "/brand/favicon.ico",
    "faviconPngSrc": "/brand/favicon.png",
    "appleTouchIconSrc": "/brand/apple-touch-icon.png",
    "installerHeroSrc": "/brand/installer-hero.webp",
    "assistantAvatarSrc": "/brand/assistant-avatar.png",
    "logoAlt": "iClaw logo"
  },
  "theme": {
    "dark": {
      "primary": "#B49A70",
      "onPrimary": "#11100F",
      "primaryHover": "#C2AA82"
    },
    "light": {
      "primary": "#A88C5D",
      "onPrimary": "#1A1A18",
      "primaryHover": "#8F7751"
    }
  },
  "storage": {
    "namespace": "iclaw"
  },
  "endpoints": {
    "authBaseUrl": "https://iclaw.aiyuanxi.com"
  },
  "oauth": {
    "wechat": {
      "appId": "",
      "redirectUri": ""
    },
    "google": {
      "clientId": "",
      "redirectUri": ""
    }
  },
  "website": {
    "homeTitle": "iClaw 官网",
    "metaDescription": "iClaw 官网，面向普通用户的本地 AI 客户端。",
    "brandLabel": "iClaw",
    "kicker": "Official Website",
    "heroTitlePre": "让AI真正像软件一样",
    "heroTitleMain": "装上就能用！",
    "heroDescription": "iClaw 面向普通用户设计。少一点配置，多一点结果。打开、提问、执行、拿答案。",
    "topCtaLabel": "下载",
    "scrollLabel": "向下下载",
    "downloadTitle": "下载 iClaw"
  },
  "distribution": {
    "artifactBaseName": "iClaw"
  }
} as const;
