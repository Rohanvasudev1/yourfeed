import {
  IconBallFootball,
  IconBallTennis,
  IconBatteryCharging,
  IconBinaryTree,
  IconBrain,
  IconBriefcase,
  IconBuildingBank,
  IconCarCrash,
  IconCash,
  IconCashBanknote,
  IconChartDots3,
  IconChartLine,
  IconChefHat,
  IconCloudStorm,
  IconCoinBitcoin,
  IconCpu,
  IconCricket,
  IconDatabase,
  IconFlame,
  IconGuitarPick,
  IconHeadphones,
  IconLayoutList,
  IconMicrophone,
  IconMicrophone2,
  IconNews,
  IconPlug,
  IconPlugConnected,
  IconRobot,
  IconShoppingCart,
  IconToolsKitchen2,
  IconTorii,
  IconTrain,
  IconTrophy,
  IconUsers,
  IconWaveSine,
  type Icon,
} from "@tabler/icons-react";

/** A designed thumbnail: gradient, big outlined caption, optional accent label and a hero icon. */
export type CaptionDesign = Readonly<{
  caption: string;
  /** The tilted label under the caption. */
  label?: string;
  icon: Icon;
  gradient: readonly [from: string, to: string];
  /** Label colour; yellow when absent. */
  accent?: string;
  /** Draws red rings and arrows, unless Honest titles is on. */
  bait?: boolean;
  /** Replaces the caption (and drops the label) when Honest titles is on. */
  honestCaption?: string;
}>;

export type VersusSide = Readonly<{ label: string; icon: Icon; color: string }>;

/** Two halves facing off with a VS sticker. */
export type VersusDesign = Readonly<{ versus: readonly [VersusSide, VersusSide] }>;

export type ThumbnailDesign = CaptionDesign | VersusDesign;

/**
 * The mockup's designs (prototype/index.html, THUMBS), keyed by demo video id.
 * Videos missing here get the generic topic design.
 */
export const THUMBNAIL_DESIGNS: Readonly<Record<string, ThumbnailDesign>> = {
  "demo-0": { caption: "AI AGENT", label: "step by step", icon: IconRobot, gradient: ["#1b1f3b", "#5b2bd6"] },
  "demo-1": {
    versus: [
      { label: "GRAPH", icon: IconChartDots3, color: "#0f3d5c" },
      { label: "TREE", icon: IconBinaryTree, color: "#13603f" },
    ],
  },
  "demo-2": { caption: "BUILD A DATABASE", label: "from scratch", icon: IconDatabase, gradient: ["#0b2027", "#00897b"] },
  "demo-3": { caption: "DON'T DO THIS", icon: IconBriefcase, gradient: ["#ff3d00", "#ffb300"], bait: true, honestCaption: "YOUR 5-YEAR PLAN" },
  "demo-4": { caption: "SCAM?!", label: "$0 left", icon: IconCoinBitcoin, gradient: ["#1a0000", "#d32f2f"], bait: true, honestCaption: "FOLLOW THE MONEY" },
  "demo-5": { caption: "RATES", label: "who decides?", icon: IconBuildingBank, gradient: ["#0d2b4d", "#3a86ff"] },
  "demo-6": { caption: "90+4'", label: "title race", icon: IconBallFootball, gradient: ["#0b3d0b", "#43a047"] },
  "demo-7": { caption: "EVERY GOAL", label: "matchweek 12", icon: IconBallFootball, gradient: ["#2a0030", "#d1006b"] },
  "demo-8": { caption: "5 SETS", label: "best points", icon: IconBallTennis, gradient: ["#14451a", "#9e9d24"] },
  "demo-9": { caption: "LAST OVER", label: "6 to win", icon: IconCricket, gradient: ["#0d3a8a", "#00acc1"] },
  "demo-10": { caption: "MAIN EVENT", label: "title match", icon: IconTrophy, gradient: ["#0a0a0a", "#b71c1c"], accent: "#ffca28" },
  "demo-11": { caption: "BURNOUT", label: "starting over", icon: IconMicrophone2, gradient: ["#2b1b16", "#8d6e63"] },
  "demo-12": { caption: "LOOKING BACK", label: "former No. 1", icon: IconMicrophone2, gradient: ["#1c262b", "#607d8b"] },
  "demo-13": { caption: "ONE TAKE", label: "4 songs", icon: IconGuitarPick, gradient: ["#3b0f73", "#f06292"] },
  "demo-14": { caption: "SUNSET SET", label: "amapiano", icon: IconHeadphones, gradient: ["#ff6f00", "#6a1b9a"] },
  "demo-15": { caption: "£10,000", label: "24 hours", icon: IconCash, gradient: ["#00a844", "#ffd600"], bait: true, accent: "#ffffff", honestCaption: "SPEND £10K" },
  "demo-16": { caption: "IT BROKE DOWN", icon: IconCarCrash, gradient: ["#5d4037", "#ff7043"], bait: true, honestCaption: "ROAD TRIP" },
  "demo-17": { caption: "TOP GOALS", label: "of the decade", icon: IconBallFootball, gradient: ["#14185c", "#ff8f00"] },
  "demo-18": { caption: "FULL CONCERT", label: "live", icon: IconMicrophone, gradient: ["#0a0a0a", "#d81b60"] },
  "demo-19": { caption: "MONEY 101", label: "from scratch", icon: IconCashBanknote, gradient: ["#0f3d14", "#66bb6a"] },
  "demo-20": { caption: "BIGGEST EVER", label: "challenge", icon: IconFlame, gradient: ["#b00000", "#ff6d00"], bait: true, honestCaption: "YEAR'S CHALLENGE" },
  "demo-21": { caption: "NEURAL NETS", label: "visually", icon: IconBrain, gradient: ["#000428", "#004e92"] },
  "demo-22": { caption: "MCP SERVER", label: "20 min", icon: IconPlugConnected, gradient: ["#2b1d14", "#d97757"] },
  "demo-23": { caption: "HOW FEEDS WORK", icon: IconLayoutList, gradient: ["#1a1a1a", "#7c4dff"] },
  "demo-24": { caption: "£0 RESEARCH", label: "user interviews", icon: IconUsers, gradient: ["#004d40", "#4db6ac"] },
  "demo-25": { caption: "15 MIN PASTA", icon: IconToolsKitchen2, gradient: ["#d84315", "#ffb300"] },
  "demo-26": { caption: "KNIFE SKILLS", label: "beginners", icon: IconChefHat, gradient: ["#263238", "#90a4ae"] },
  "demo-27": { caption: "2004 vs 2024", label: "the serve", icon: IconBallTennis, gradient: ["#003d33", "#26a69a"] },
  "demo-28": { caption: "JAPAN", label: "on a budget", icon: IconTorii, gradient: ["#8e0000", "#ff5252"] },
  "demo-29": { caption: "MCP + YOUR APP", icon: IconPlug, gradient: ["#1e1e1e", "#cc785c"] },
  "demo-30": { caption: "NIGHT TRAINS", label: "across Europe", icon: IconTrain, gradient: ["#0d1b2a", "#415a77"] },
  "demo-31": { caption: "TODAY", label: "5 stories", icon: IconNews, gradient: ["#7f0000", "#c62828"] },
  "demo-32": { caption: "PRICES ↑", label: "why now?", icon: IconShoppingCart, gradient: ["#3e2723", "#ef6c00"] },
  "demo-33": { caption: "AI THIS WEEK", icon: IconCpu, gradient: ["#0a1931", "#185adb"] },
  "demo-34": { caption: "MARKETS", label: "today", icon: IconChartLine, gradient: ["#003300", "#2e7d32"] },
  "demo-35": { caption: "QUAKE ALERT", label: "early warning", icon: IconWaveSine, gradient: ["#1a237e", "#00838f"] },
  "demo-36": { caption: "STORM UPDATE", icon: IconCloudStorm, gradient: ["#101820", "#455a64"], accent: "#ff5252" },
  "demo-37": { caption: "BATTERY", label: "explained", icon: IconBatteryCharging, gradient: ["#00251a", "#00bfa5"] },
};

export const isVersus = (design: ThumbnailDesign): design is VersusDesign => "versus" in design;
