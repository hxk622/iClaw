export const BRAND = {
  "brandId": "caiclaw",
  "productName": "理财客",
  "displayName": "理财客",
  "websiteTitle": "理财客",
  "devWebsiteTitle": "理财客-dev",
  "defaultThemeMode": "dark",
  "sidebarTitle": "理财客",
  "devSidebarTitle": "理财客-dev",
  "sidebarSubtitle": "",
  "legalName": "理财客",
  "bundleIdentifier": "ai.caiclaw.desktop",
  "authService": "ai.caiclaw.desktop",
  "assets": {
    "faviconIcoSrc": "/brand/favicon.ico",
    "faviconPngSrc": "/brand/favicon.png",
    "brandMarkSrc": "/brand/brand-mark.png",
    "appleTouchIconSrc": "/brand/apple-touch-icon.png",
    "installerHeroSrc": "/brand/installer-hero.webp",
    "assistantAvatarSrc": "/brand/assistant-avatar.png",
    "logoAlt": "理财客 logo"
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
    "namespace": "caiclaw"
  },
  "endpoints": {
    "authBaseUrl": "https://caiclaw.aiyuanxi.com"
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
    "homeTitle": "理财客官网",
    "metaDescription": "理财客官网，面向财富管理场景的本地 AI 客户端。",
    "brandLabel": "理财客",
    "kicker": "Official Website",
    "heroTitlePre": "把 AI 装进你的财富工作流",
    "heroTitleMain": "打开就能干活",
    "heroDescription": "理财客面向财富管理场景设计。少一点配置，多一点交付。",
    "topCtaLabel": "下载",
    "scrollLabel": "向下下载",
    "downloadTitle": "下载理财客"
  },
  "distribution": {
    "artifactBaseName": "LiCaiClaw"
  },
  "build": {
    "version": "1.0.9+202604171540",
    "stamp": {
      "brandId": "caiclaw",
      "productName": "理财客",
      "bundleIdentifier": "ai.caiclaw.desktop",
      "artifactBaseName": "LiCaiClaw",
      "buildId": "202604171540",
      "sourceProfileHash": "6d3b1579336385d87f2af1c90ceeab43079ac5ba8695f52e6917e6320d682e60"
    }
  }
} as const;
