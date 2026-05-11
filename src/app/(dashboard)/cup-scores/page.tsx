"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import s from "./cup.module.css";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Coffee = {
  lot: string; series: string; name: string; type: string;
  estate: string; process: string; processDetail: string;
  score: number; priceINR: string; priceUSD: string;
  date: string; field: string; acidity: string; body: string;
  notes: string; qty: string; year: number;
  _id?: string; _userAdded?: boolean;
};

type ThemeKey = "forest" | "coffee" | "navy" | "burgundy" | "slate";

/* ── Themes ─────────────────────────────────────────────────────────────────── */
const THEMES: Record<ThemeKey, { label: string; swatch: string; vars: Record<string, string> }> = {
  forest:   { label: "Forest Green", swatch: "#1b4a1b", vars: { "--green-dark": "#1b4a1b", "--green-mid": "#2d6e2d", "--cream": "#fdf8ee", "--border": "#e5dfc8" } },
  coffee:   { label: "Deep Coffee",  swatch: "#3e2010", vars: { "--green-dark": "#3e2010", "--green-mid": "#6b3a1f", "--cream": "#fdf5ee", "--border": "#e8d8c4" } },
  navy:     { label: "Navy Blue",    swatch: "#1a2a4a", vars: { "--green-dark": "#1a2a4a", "--green-mid": "#253d6e", "--cream": "#f0f4ff", "--border": "#d0d8f0" } },
  burgundy: { label: "Burgundy",     swatch: "#4a1020", vars: { "--green-dark": "#4a1020", "--green-mid": "#7a1f35", "--cream": "#fff0f3", "--border": "#f0d0d8" } },
  slate:    { label: "Slate",        swatch: "#2a3540", vars: { "--green-dark": "#2a3540", "--green-mid": "#3d5060", "--cream": "#f2f5f7", "--border": "#d4dde3" } },
};

/* ── Coffee Data ────────────────────────────────────────────────────────────── */
const COFFEES: Coffee[] = [
  {lot:"31",series:"Nano Lot",name:"NANO LOT NATURALS",type:"Arabica Natural",estate:"Moganad Estate",process:"Natural",processDetail:"Multi-Fermentation 384 Hours",score:85,priceINR:"₹1,250",priceUSD:"$14.20",date:"22 Dec 24",field:"10¾ Acre",acidity:"Medium",body:"Medium+",notes:"Peach, passion fruit, candied walnut, cacao nib",qty:"890 kg",year:2025},
  {lot:"48",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Orchardale Estate",process:"Washed",processDetail:"Sugarcane 48 Hrs",score:83.5,priceINR:"₹900",priceUSD:"$10.80",date:"07 Feb 25",field:"Line Keel Thundu",acidity:"Medium to Medium+",body:"Medium+",notes:"Baking chocolate, walnut, citrus, orange zest, dates, cacao nib",qty:"483 kg",year:2025},
  {lot:"49",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Orchardale Estate",process:"Washed",processDetail:"Mandarin (Kamala Orange) 48 Hrs",score:82.75,priceINR:"₹900",priceUSD:"$10.80",date:"08 Feb 25",field:"Kamalkadu",acidity:"Medium",body:"Medium",notes:"Roasted almond, cacao nib, citrus zest",qty:"550 kg",year:2025},
  {lot:"50",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Hidden Falls Estate",process:"Washed",processDetail:"Yeast Inoculation",score:85,priceINR:"₹900",priceUSD:"$10.80",date:"—",field:"—",acidity:"Brisk",body:"Syrupy",notes:"Fig, baking chocolate, goji berry, brown sugar, undertones of goji berry and dark chocolate",qty:"485 kg",year:2025},
  {lot:"54",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Hidden Falls Estate",process:"Washed",processDetail:"Natural Yeast 48 Hrs",score:83.75,priceINR:"₹900",priceUSD:"$10.80",date:"23 Jan 25",field:"Ramarao Field",acidity:"Medium",body:"Medium+",notes:"Intense aromatics, black grapes, grapefruit peel, cacao nib, orange zest",qty:"300 kg",year:2025},
  {lot:"56",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Extended Multi-Fermentation 650+ Hours",score:86,priceINR:"₹1,400",priceUSD:"$16.50",date:"29 Dec 24",field:"Meelish",acidity:"Sweet tart",body:"Velvety",notes:"Vibrant fruit driven, berries, tamarind, huckleberry, honeysuckle, lemon verbena",qty:"1,886 kg",year:2025},
  {lot:"67",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Stanmore Estate",process:"Washed",processDetail:"Yeast 48 Hrs",score:83,priceINR:"₹900",priceUSD:"$10.80",date:"29 Dec 24",field:"Nagalur Field",acidity:"Dry / Medium",body:"Medium",notes:"Almond, sweetlime, citrus, bakers chocolate",qty:"536 kg",year:2025},
  {lot:"95",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Arabica PSD",estate:"Bison Valley Estate",process:"Black Honey / PSD",processDetail:"Black Honey 48 Hrs Double Fermentation",score:82.25,priceINR:"₹1,000",priceUSD:"$12.00",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"682 kg",year:2025},
  {lot:"96",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Stanmore Estate",process:"Washed",processDetail:"Watermelon Process 48 Hrs",score:83.75,priceINR:"₹900",priceUSD:"$10.80",date:"12 Feb 25",field:"Yeriputhukkadu",acidity:"Bright, Juicy",body:"Silky smooth",notes:"Watermelon candy, almond brittle, lemon verbena",qty:"—",year:2025},
  {lot:"106",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Moganad Estate",process:"Natural",processDetail:"Multi-Fermentation 960 Hours",score:86.25,priceINR:"₹1,400",priceUSD:"$16.50",date:"21 Dec 24",field:"Line Field",acidity:"Bright & Complex",body:"Medium+, Syrupy",notes:"Ripe plums, cherry, grapefruit zest, honeysuckle, cacao nib",qty:"650 kg",year:2025},
  {lot:"109",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 72 Hours",score:87.75,priceINR:"₹1,500",priceUSD:"$16.50",date:"02 Feb 25",field:"Yeriputhukkadu",acidity:"Sweet acidity",body:"Medium, silky mouthfeel",notes:"Fruity, gentle spice, blackberry, dark fruits, red wine",qty:"937 kg",year:2025},
  {lot:"111",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Extended Multi-Fermentation 900+ Hours",score:88.5,priceINR:"₹1,500",priceUSD:"$16.50",date:"—",field:"—",acidity:"Bright",body:"Medium+",notes:"Exotic red fruits, candied fennel, black cherry, sangria",qty:"905 kg",year:2025},
  {lot:"135",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Orchardale Estate",process:"Natural",processDetail:"Triple Fermentation + ICE Blast",score:86,priceINR:"₹1,400",priceUSD:"$16.50",date:"06 Feb 25",field:"Kali Kovil",acidity:"Complex (citric, malic, acetic)",body:"Medium+, Syrupy",notes:"Black cherry, raisin, blueberry compote, candied kumquat, dark grapes, wine",qty:"756 kg",year:2025},
  {lot:"136",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Orchardale Estate",process:"Natural",processDetail:"Extended Multi-Fermentation 650+ Hours",score:87.5,priceINR:"₹1,500",priceUSD:"$16.50",date:"26 Jan 25",field:"Kamala Kadu",acidity:"Bright & Juicy",body:"Silky",notes:"Blackberry, blueberry compote, oolong tea, honey, berry and dark plum sweetness",qty:"1,175 kg",year:2025},
  {lot:"137",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Bison Valley Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 240+ Hours",score:86.5,priceINR:"₹1,400",priceUSD:"$16.50",date:"08 Feb 25",field:"Nadu Level",acidity:"Bright acidity",body:"Medium to Medium+, juicy",notes:"Citrus blossom, pear, mandarin, floral",qty:"564 kg",year:2025},
  {lot:"139",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Bison Valley Estate",process:"Natural",processDetail:"Extended Multi-Fermentation 650+ Hours",score:87.5,priceINR:"₹1,500",priceUSD:"$16.50",date:"28 Jan 25",field:"Pammandicholai",acidity:"Complex",body:"Medium+",notes:"Caramel toffee, figs, goji berry, aged wine, prunes, complex fruits",qty:"550 kg",year:2025},
  {lot:"144",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Arabica PSD",estate:"Moganad Estate",process:"Black Honey / PSD",processDetail:"48 Hrs Arabica Black Honey",score:86.25,priceINR:"₹1,200",priceUSD:"$14.20",date:"30 Dec 24",field:"Nodichikkal",acidity:"Bright vibrant",body:"Medium+",notes:"Floral, tea, jasmine, peach, pink grapefruit",qty:"575 kg",year:2025},
  {lot:"148",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Arabica PSD",estate:"Orchardale Estate",process:"Black Honey / PSD",processDetail:"48 Hrs Black Honey",score:83.25,priceINR:"₹1,000",priceUSD:"$12.00",date:"03 Jan 25",field:"Line Mel Thundu",acidity:"Medium+",body:"Medium",notes:"Sweet aromatic, raisin, mild toffee, sweetlime zest",qty:"378 kg",year:2025},
  {lot:"152",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Bison Valley Estate",process:"Washed",processDetail:"Double Fermentation, Extended Slow Dry",score:84.5,priceINR:"₹900",priceUSD:"$10.80",date:"04 Jan 25",field:"Nadu Level",acidity:"Refreshing, bright",body:"Well rounded, smooth",notes:"Golden kiwi, white chocolate, mandarin orange, sweet",qty:"2,508 kg",year:2025},
  {lot:"153",series:"Gold Series",name:"GOLD SERIES WASHED",type:"Arabica Washed",estate:"Stanmore Estate",process:"Washed",processDetail:"Triple Fermentation + ICE Blast",score:86.75,priceINR:"₹1,000",priceUSD:"$12.00",date:"03 Dec 24",field:"Meelish",acidity:"Bright, sweet",body:"Medium",notes:"Complex fruits, jaggery, dates, dark fruits, black currant",qty:"1,532 kg",year:2025},
  {lot:"155",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Hidden Falls Estate",process:"Washed",processDetail:"Double Fermentation, Extended Slow Dry",score:84.5,priceINR:"₹900",priceUSD:"$10.80",date:"18 Dec 24",field:"Puthur Pallam",acidity:"Sweet, effervescent",body:"Syrupy, medium+",notes:"Wine toned, muscat grapes, hibiscus, dark chocolate, almond, cocoa",qty:"1,878 kg",year:2025},
  {lot:"156",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Arabica PSD",estate:"Orchardale Estate",process:"Black Honey / PSD",processDetail:"Watermelon Black Honey 48 Hrs",score:84.25,priceINR:"₹1,100",priceUSD:"$13.00",date:"24 Feb 25",field:"Aathukkadu",acidity:"Bright",body:"Medium",notes:"Bright, mild floral, dark grape sweetness, black currant, pomegranate with plum undertones",qty:"518 kg",year:2025},
  {lot:"157",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Orchardale Estate",process:"Washed",processDetail:"Watermelon Process 48 Hrs",score:84.75,priceINR:"₹900",priceUSD:"$10.80",date:"21 Feb 25",field:"Vandimudakkam",acidity:"Sweet/tart",body:"Light but silky",notes:"Floral, bright, fruit forward, red currant, mandarin orange, honeysuckle",qty:"1,238 kg",year:2025},
  {lot:"160",series:"Gold Series",name:"GOLD SERIES WASHED",type:"Arabica Washed",estate:"Bison Valley Estate",process:"Washed",processDetail:"Brown Sugar Process",score:86.25,priceINR:"₹1,000",priceUSD:"$12.00",date:"19 Feb 25",field:"Pommidi Quarters",acidity:"Medium+, Intense",body:"Medium",notes:"Complex, brown sugar, berries, nuts",qty:"2,548 kg",year:2025},
  {lot:"163",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Robusta Natural",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Natural",score:86.5,priceINR:"₹800",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Vanilla, chocolate aromatics. Cocoa butter, brown sugar, hint of maple syrup",qty:"1,614 kg",year:2025},
  {lot:"166",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Moganad Estate",process:"Washed",processDetail:"Watermelon Process 48 Hrs",score:84.25,priceINR:"₹900",priceUSD:"$10.80",date:"21 Feb 25",field:"Marriamman Kovil",acidity:"Bright, Sweet",body:"Medium",notes:"Mandarin, milk chocolate, raisin",qty:"1,819 kg",year:2025},
  {lot:"167",series:"Gold Series",name:"GOLD SERIES WASHED",type:"Arabica Washed",estate:"Moganad Estate",process:"Washed",processDetail:"Triple Fermentation + ICE Blast",score:86.75,priceINR:"₹1,000",priceUSD:"$12.00",date:"20 Dec 24",field:"Vyapurikuttai Div",acidity:"Complex",body:"Medium, well rounded",notes:"Mulberry, peach, palm sugar, dried fig, elderflower, sweet wine",qty:"4,014 kg",year:2025},
  {lot:"170",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Robusta PSD",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Black Honey",score:85.75,priceINR:"₹750",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Good body, nice complexity. Almond butter, cocoa, nutmeg hints. Soft and smooth",qty:"892 kg",year:2025},
  {lot:"173",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Robusta PSD",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Black Honey",score:86.25,priceINR:"₹800",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Balanced characters. Milk chocolate, roasted walnut, raisin, dried dates. Balanced finish",qty:"1,676 kg",year:2025},
  {lot:"177",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Stanmore Estate",process:"Washed",processDetail:"Watermelon Process 48 Hrs",score:84,priceINR:"₹900",priceUSD:"$10.80",date:"—",field:"—",acidity:"Sweet / medium",body:"Velvety / smooth",notes:"Sweet, chocolatey, lavender, rose hip, baking chocolate",qty:"723 kg",year:2025},
  {lot:"180",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"48 Hrs Black Honey",score:87,priceINR:"₹1,200",priceUSD:"$14.20",date:"09 Feb 25",field:"Meelish",acidity:"Sweet, medium",body:"Medium, dense mouthfeel",notes:"Jamun, red plum, sapota, molasses, stone fruit",qty:"633 kg",year:2025},
  {lot:"187a",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Arabica PSD",estate:"Bison Valley Estate",process:"Black Honey / PSD",processDetail:"Mandarin (Kamala Orange) Black Honey",score:86.25,priceINR:"₹1,200",priceUSD:"$13.00",date:"01 Mar 25",field:"BBTC Puthukkadu",acidity:"Bright acidity",body:"Juicy, silky mouthfeel",notes:"Tangerine, peaches, mandarin, kiwi, floral",qty:"664 kg",year:2025},
  {lot:"187b",series:"Small Batch",name:"SMALL BATCH NATURALS",type:"Robusta Natural",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Natural",score:84.5,priceINR:"₹700",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Sweet-toned. Milk chocolate, nut-driven. Cashew, hazelnut brittle, maple. Baker's chocolate finish",qty:"1,461 kg",year:2025},
  {lot:"189",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Robusta Natural",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Natural",score:86.25,priceINR:"₹800",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Intense flavour. Hazelnut, butterscotch. Sweetness balances coffee and flavours",qty:"1,812 kg",year:2025},
  {lot:"200",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 72 Hours",score:87.75,priceINR:"₹1,500",priceUSD:"$16.50",date:"—",field:"—",acidity:"Sweet",body:"Syrupy",notes:"Mulberry, black cherry, palm sugar, rum-like syrupy dark cherry",qty:"12,892 kg",year:2025},
  {lot:"201",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Orchardale Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 240+ Hours",score:86,priceINR:"₹1,300",priceUSD:"$15.30",date:"—",field:"—",acidity:"Sweet, balanced",body:"Syrupy, balanced",notes:"Deep toned and berry forward, wild honey, mixed berry",qty:"11,066 kg",year:2025},
  {lot:"202",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Moganad Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 240+ Hours",score:86.25,priceINR:"₹1,300",priceUSD:"$15.30",date:"—",field:"—",acidity:"Bright",body:"Medium+",notes:"Dark plum, acai berry, dark plum, black raisin",qty:"4,985 kg",year:2025},
  {lot:"203",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Bison Valley Estate",process:"Natural",processDetail:"Extended Multi-Fermentation 900+ Hours",score:87.75,priceINR:"₹1,500",priceUSD:"$16.50",date:"—",field:"—",acidity:"Sweet",body:"Syrupy / silky",notes:"Mixed cherries, dark plums, dark berries, stone fruit, jaggery",qty:"1,028 kg",year:2025},
  {lot:"204",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Arabica Natural",estate:"Hidden Falls Estate",process:"Natural",processDetail:"Alternate Multi-Fermentation 240+ Hours",score:88,priceINR:"₹1,500",priceUSD:"$16.50",date:"—",field:"—",acidity:"Juicy bright",body:"Medium+, Syrupy",notes:"Raspberry coulis, wine barrel, dark chocolate, wine",qty:"855 kg",year:2025},
  {lot:"205",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Black Honey 48 Hrs",score:82.25,priceINR:"₹1,000",priceUSD:"$12.00",date:"—",field:"—",acidity:"Light / medium",body:"Medium",notes:"Orange zest, roasted almond, nuts, brown sugar, walnut",qty:"1,547 kg",year:2025},
  {lot:"206",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Arabica PSD",estate:"Moganad Estate",process:"Black Honey / PSD",processDetail:"Black Honey Espresso",score:87.25,priceINR:"₹1,200",priceUSD:"$14.20",date:"—",field:"—",acidity:"Bright",body:"Medium+",notes:"Complex, agave syrup, yellow plum, rum, toffee, hazelnut",qty:"2,220 kg",year:2025},
  {lot:"207",series:"Gold Series",name:"GOLD SERIES BLACK HONEY",type:"Arabica PSD",estate:"Bison Valley Estate",process:"Black Honey / PSD",processDetail:"Competition Batch Black Honey Espresso",score:87.5,priceINR:"₹1,200",priceUSD:"$14.20",date:"—",field:"—",acidity:"Bright",body:"Medium, vibrant syrupy",notes:"Dark fruits, black cherry, rum & chocolate fudge, chocolaty finish with hazelnut and rum, whiskey barrel",qty:"201 kg",year:2025},
  {lot:"208",series:"Small Batch",name:"SMALL BATCH BLACK HONEY",type:"Arabica PSD",estate:"Orchardale Estate",process:"Black Honey / PSD",processDetail:"Watermelon Black Honey",score:84,priceINR:"₹1,100",priceUSD:"$13.00",date:"—",field:"—",acidity:"Intense, well rounded",body:"Medium+, Viscous",notes:"Multi-layered, black cherry, red plum, roasted walnut, sweetlime, cocoa nib",qty:"782 kg",year:2025},
  {lot:"209",series:"Small Batch",name:"SMALL BATCH WASHED",type:"Arabica Washed",estate:"Orchardale Estate",process:"Washed",processDetail:"Watermelon Process 48 Hrs",score:83.75,priceINR:"₹900",priceUSD:"$10.80",date:"—",field:"—",acidity:"Bright / sweet",body:"Medium+",notes:"Hazelnut, milk chocolate, honey, cocoa, lime zest",qty:"985 kg",year:2025},
  {lot:"210",series:"Nano Lot",name:"NANO LOT NATURALS",type:"Arabica Natural",estate:"Bison Valley Estate",process:"Natural",processDetail:"Papaya Process",score:85.25,priceINR:"₹1,250",priceUSD:"$14.20",date:"—",field:"—",acidity:"Vibrant",body:"Smooth",notes:"Red fruit, papaya, sapota (chikku), complex",qty:"254 kg",year:2025},
  {lot:"211",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Robusta Natural",estate:"Moganad Estate",process:"Robusta",processDetail:"Robusta Natural (Bulk)",score:86.75,priceINR:"₹800",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"Chocolate, caramel, nut notes. Smooth and round. Hint of bitter edge in aftertaste",qty:"3,678 kg",year:2025},
  {lot:"212",series:"Gold Series",name:"GOLD SERIES NATURALS",type:"Robusta Natural",estate:"Hidden Falls Estate",process:"Robusta",processDetail:"Robusta Natural Watermelon",score:86,priceINR:"₹800",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"1,637 kg",year:2025},
  {lot:"213",series:"Gold Series",name:"GOLD SERIES NATURALS — GAUR'S DEN",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Micro Lot – Gaur's Den Organic",score:86,priceINR:"₹1,600",priceUSD:"$16.50",date:"—",field:"—",acidity:"Bright, zesty",body:"Silky / smooth",notes:"Cane sugar, mandarin, plum, raisin, hazelnut",qty:"102 kg",year:2025},
  {lot:"A1",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Sampangi Flower Infusion",score:84.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A2",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Marikkozhunthu (Marjoram)",score:85.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A3",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Gundumalli (Arabian Jasmine)",score:86.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A4",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Banana Infusion",score:87.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A5",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Seethapalam (Custard Apple)",score:87.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A6",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Pepper + Mango",score:84.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A7",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Clove + Mango",score:84.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A8",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Orange Peel",score:88,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Bright (medium to Medium+)",body:"Well layered, light to medium",notes:"Pomegranate, melon and grapefruit. Nice layered coffee, medium dry finish",qty:"Micro",year:2025},
  {lot:"A9",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Raja Flower",score:84.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A10",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Grape Infusion",score:84.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A11",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Grapefruit (Bomblimas)",score:84.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"A12",series:"Limited Edition",name:"PROJECT MSP 90+ NATURAL",type:"Arabica Natural",estate:"Stanmore Estate",process:"Natural",processDetail:"Pudina (Coriander)",score:87.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"—",body:"—",notes:"—",qty:"Micro",year:2025},
  {lot:"B01",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Sampangi Flower / Magnolia Champaca",score:86.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Bright",body:"Creamy mouthfeel",notes:"Very elegant. Butterscotch, honeysuckle, coconut, muscat grape, bergamot",qty:"Micro",year:2025},
  {lot:"B02",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Marikkozhunthu (Marjoram)",score:84.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Delicate but bright",body:"Medium",notes:"Grapes, kiwi & green apple with almond and caramel sweetness. Better as it cools",qty:"Micro",year:2025},
  {lot:"B03",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Gundumalli (Arabian Jasmine / Jasminum sambac)",score:86,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Clean and bright",body:"Medium",notes:"Floral, tangerine, orange blossom and caramel sweetness",qty:"Micro",year:2025},
  {lot:"B04",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Banana Honey",score:85.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Medium+",body:"Medium",notes:"Citrus nuances. Orange zest, hint of stone fruits, brown sugar aftertaste",qty:"Micro",year:2025},
  {lot:"B05",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Seethapalam (Custard Apple)",score:85.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Sweet & bright",body:"Creamy",notes:"Raspberry, sweet cocoa, magnolia, cashew butter, orange zest",qty:"Micro",year:2025},
  {lot:"B06",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Pepper + Mango Honey",score:84,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Pleasant balanced",body:"Medium+",notes:"Raisin, honey, grapefruit, Dutch cocoa, milk chocolate",qty:"Micro",year:2025},
  {lot:"B07",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Clove + Mango Honey",score:85.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Well rounded",body:"Medium+, satin mouthfeel",notes:"Cinnamon, dates, nutmeg, hint of orange zest",qty:"Micro",year:2025},
  {lot:"B08",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Orange Peel Honey",score:84.75,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Rounded bright",body:"Medium+",notes:"Meyer lemon, Concord grape, star fruit brightness. Turns to white grape juiciness as it cools, mild brown sugar",qty:"Micro",year:2025},
  {lot:"B09",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Rose Flower Honey",score:85,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Assertive brightness",body:"Medium",notes:"Sweet lime, caramel, raisins and citrus blossom. Extremely well balanced cup",qty:"Micro",year:2025},
  {lot:"B10",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Grape Honey",score:87.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Bright",body:"Medium+",notes:"Hazelnut, hints of cardamom, nutmeg, lilac and plums, sandalwood undertones",qty:"Micro",year:2025},
  {lot:"B11",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Pink Grapefruit (Bomblimas)",score:86.5,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Gentle, round",body:"Satin, creamy",notes:"Sweet, lime zest, dried apricot, chocolate fudge, agave syrup, deep cherry finish",qty:"Micro",year:2025},
  {lot:"B12",series:"Limited Edition",name:"PROJECT MSP 90+ HONEY",type:"Arabica PSD",estate:"Stanmore Estate",process:"Black Honey / PSD",processDetail:"Pudina / Spearmint (Mentha spicata)",score:86.25,priceINR:"—",priceUSD:"—",date:"—",field:"—",acidity:"Crisp",body:"Smooth, medium",notes:"Red apple, raisin and dragon fruit forefront. Milk chocolate, custard apple and white chocolate finish",qty:"Micro",year:2025},
];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function getTier(score: number) {
  if (score >= 89) return { label: "Exceptional", color: "#dc2626" };
  if (score >= 87) return { label: "Outstanding", color: "#d97706" };
  if (score >= 85) return { label: "Excellent",   color: "#059669" };
  if (score >= 83) return { label: "Very Good",   color: "#3b82f6" };
  return               { label: "Good",        color: "#7c6d5a" };
}

const SERIES_BADGE: Record<string, string> = {
  "Gold Series":     s.badgeGold,
  "Small Batch":     s.badgeSmall,
  "Nano Lot":        s.badgeNano,
  "Limited Edition": s.badgeLimited,
};

const ESTATE_COLORS: Record<string, string> = {
  "Stanmore Estate":     "#1b5e20",
  "Moganad Estate":      "#1a237e",
  "Orchardale Estate":   "#4a148c",
  "Bison Valley Estate": "#e65100",
  "Hidden Falls Estate": "#006064",
};

function parseTasteNotes(notes: string): string[] {
  if (!notes || notes === "—") return [];
  return notes.split(/,|\./).map(t => t.trim()).filter(t => t.length > 1 && t.length < 35).slice(0, 5);
}

const BLANK_FORM = {
  year: "", lot: "", series: "Gold Series", name: "", type: "", estate: "Stanmore Estate",
  process: "Natural", processDetail: "", field: "", score: "", priceINR: "", priceUSD: "",
  acidity: "", body: "", notes: "", date: "", qty: "",
};

/* ── Coffee Card ─────────────────────────────────────────────────────────────── */
function CoffeeCard({ coffee: c, onDelete }: { coffee: Coffee; onDelete: (id: string) => void }) {
  const tier = getTier(c.score);
  const tasteTags = parseTasteNotes(c.notes);
  const estColor = ESTATE_COLORS[c.estate] || "#1b4a1b";

  return (
    <div className={`${s.card} ${c._userAdded ? s.userAdded : ""}`}>
      <div className={s.cardTop}>
        <div className={s.cardMeta}>
          <div className={s.lotLine}>
            <span className={s.lotNum}>LOT {c.lot}</span>
            <span className={`${s.seriesBadge} ${SERIES_BADGE[c.series] || s.badgeSmall}`}>
              {c.series === "Limited Edition" ? "Ltd Edition" : c.series}
            </span>
            <span className={s.yearPill}>{c.year}</span>
            {c._userAdded && c._id && (
              <button className={s.delBtn} onClick={() => onDelete(c._id!)}>✕ Delete</button>
            )}
          </div>
          <div className={s.cardName}>{c.name}</div>
          <div className={s.cardEstate}>
            <div className={s.estateDot} style={{ background: estColor }} />
            <span style={{ color: estColor, fontWeight: 600 }}>{c.estate}</span>
          </div>
        </div>
        <div className={s.scoreCircle} style={{ borderColor: tier.color, color: tier.color }}>
          <div className={s.scoreNum}>{c.score}</div>
          <div className={s.scoreLabel}>{tier.label}</div>
        </div>
      </div>
      <div className={s.cardDivider} />
      <div className={s.cardProcess}>
        <span className={s.processTag}>{c.type}</span>
        <span className={s.processTag}>{c.processDetail}</span>
        <div className={s.cardPrice}>
          <span className={s.priceInr}>{c.priceINR}</span>
          {c.priceUSD !== "—" && <span className={s.priceUsd}>{c.priceUSD}</span>}
        </div>
      </div>
      {c.acidity !== "—" && (
        <div className={s.cardNotes}>
          {c.acidity !== "—" && <div className={s.notesSection}><span className={s.notesLabel}>Acidity</span><div className={s.notesValue}>{c.acidity}</div></div>}
          {c.body !== "—" && <div className={s.notesSection}><span className={s.notesLabel}>Body</span><div className={s.notesValue}>{c.body}</div></div>}
          {tasteTags.length > 0 && (
            <div className={s.notesSection}>
              <span className={s.notesLabel}>Taste Notes</span>
              <div className={s.tasteTags}>{tasteTags.map((t, i) => <span key={i} className={s.tasteTag}>{t}</span>)}</div>
            </div>
          )}
        </div>
      )}
      <div className={s.cardBottom}>
        <div className={s.metaItem}><div className={s.metaLbl}>Date</div><div className={s.metaVal}>{c.date}</div></div>
        {c.field !== "—" && <div className={s.metaItem}><div className={s.metaLbl}>Field</div><div className={s.metaVal}>{c.field}</div></div>}
        <div className={s.metaItem}><div className={s.metaLbl}>Qty</div><div className={s.metaVal}>{c.qty}</div></div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function CupScoresPage() {
  const [extraScores, setExtraScores] = useState<Coffee[]>([]);
  const [themeKey, setThemeKey]       = useState<ThemeKey>("forest");
  const [lastUpdated, setLastUpdated] = useState("No entries added yet");
  const [fYear, setFYear]             = useState("");
  const [fEstate, setFEstate]         = useState("");
  const [fProcess, setFProcess]       = useState("");
  const [fSeries, setFSeries]         = useState("");
  const [fScore, setFScore]           = useState("");
  const [fSearch, setFSearch]         = useState("");
  const [sortBy, setSortBy]           = useState("score");
  const [modalOpen, setModalOpen]     = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [form, setForm]               = useState({ ...BLANK_FORM });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [clockTime, setClockTime]     = useState("--:--:--");
  const [clockDate, setClockDate]     = useState("");

  useEffect(() => {
    try { setExtraScores(JSON.parse(localStorage.getItem("msp_extra_scores") || "[]")); } catch {}
    const saved = localStorage.getItem("msp_cup_theme") as ThemeKey;
    if (saved && THEMES[saved]) setThemeKey(saved);
    setLastUpdated(localStorage.getItem("msp_last_updated") || "No entries added yet");
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setClockDate(now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const allCoffees    = useMemo(() => [...COFFEES, ...extraScores], [extraScores]);
  const availYears    = useMemo(() => [...new Set(allCoffees.map(c => c.year))].sort((a, b) => b - a), [allCoffees]);
  const yearFiltered  = useMemo(() => fYear ? allCoffees.filter(c => String(c.year) === fYear) : allCoffees, [allCoffees, fYear]);

  const filteredData = useMemo(() => {
    const data = allCoffees.filter(c => {
      if (fYear && String(c.year) !== fYear) return false;
      if (fEstate && c.estate !== fEstate) return false;
      if (fProcess && c.process !== fProcess) return false;
      if (fSeries && c.series !== fSeries) return false;
      if (fScore && c.score < parseFloat(fScore)) return false;
      if (fSearch) {
        const hay = (c.name + c.estate + c.process + c.processDetail + c.notes + c.type + c.lot).toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
    return [...data].sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "lot") {
        const al = isNaN(Number(a.lot)) ? a.lot : Number(a.lot);
        const bl = isNaN(Number(b.lot)) ? b.lot : Number(b.lot);
        return al < bl ? -1 : al > bl ? 1 : 0;
      }
      if (sortBy === "estate") return a.estate.localeCompare(b.estate);
      if (sortBy === "price") {
        const ap = parseFloat((a.priceINR || "0").replace(/[₹,]/g, "")) || 0;
        const bp = parseFloat((b.priceINR || "0").replace(/[₹,]/g, "")) || 0;
        return bp - ap;
      }
      return 0;
    });
  }, [allCoffees, fYear, fEstate, fProcess, fSeries, fScore, fSearch, sortBy]);

  const summary = useMemo(() => {
    const data = yearFiltered;
    const total = data.length;
    const avg = total ? (data.reduce((sum, c) => sum + c.score, 0) / total).toFixed(2) : "—";
    const top = total ? Math.max(...data.map(c => c.score)) : 0;
    const topLots = COFFEES.filter(c => c.score === top).map(c => "Lot " + c.lot).slice(0, 3).join(", ");
    const outstanding = data.filter(c => c.score >= 87).length;
    const estateCount = new Set(data.map(c => c.estate)).size;
    const years = [...new Set(allCoffees.map(c => c.year))].sort();
    return { total, avg, top, topLots, outstanding, estateCount, years };
  }, [yearFiltered, allCoffees]);

  const estateChartData = useMemo(() => {
    const defs = [
      { name: "Stanmore",    full: "Stanmore Estate",     color: "#1b5e20" },
      { name: "Moganad",     full: "Moganad Estate",      color: "#1a237e" },
      { name: "Orchardale",  full: "Orchardale Estate",   color: "#4a148c" },
      { name: "Bison Valley",full: "Bison Valley Estate", color: "#e65100" },
      { name: "Hidden Falls",full: "Hidden Falls Estate", color: "#006064" },
    ];
    return defs.map(d => {
      const lots = yearFiltered.filter(c => c.estate === d.full);
      return { name: d.name, avg: lots.length ? parseFloat((lots.reduce((sum, c) => sum + c.score, 0) / lots.length).toFixed(2)) : 0, fill: d.color };
    });
  }, [yearFiltered]);

  const processChartData = useMemo(() => [
    { name: "Natural",           value: yearFiltered.filter(c => c.process === "Natural").length,           fill: "#2e7d32" },
    { name: "Washed",            value: yearFiltered.filter(c => c.process === "Washed").length,            fill: "#1565c0" },
    { name: "Black Honey / PSD", value: yearFiltered.filter(c => c.process === "Black Honey / PSD").length, fill: "#b5770a" },
    { name: "Robusta",           value: yearFiltered.filter(c => c.process === "Robusta").length,           fill: "#5d4037" },
  ].filter(d => d.value > 0), [yearFiltered]);

  const distChartData = useMemo(() => [
    { range: "80–82", count: yearFiltered.filter(c => c.score >= 80 && c.score < 83).length, fill: "#7c6d5a" },
    { range: "83–84", count: yearFiltered.filter(c => c.score >= 83 && c.score < 85).length, fill: "#3b82f6" },
    { range: "85–86", count: yearFiltered.filter(c => c.score >= 85 && c.score < 87).length, fill: "#059669" },
    { range: "87–88", count: yearFiltered.filter(c => c.score >= 87 && c.score < 89).length, fill: "#d97706" },
    { range: "89+",   count: yearFiltered.filter(c => c.score >= 89).length,                 fill: "#dc2626" },
  ], [yearFiltered]);

  const saveScore = () => {
    const year = parseInt(form.year);
    const score = parseFloat(form.score);
    if (!year || !form.lot.trim() || !form.name.trim() || isNaN(score)) {
      alert("Please fill in Year, Lot No, Name and Cup Score."); return;
    }
    const rec: Coffee = {
      _id: editId || Date.now().toString(), _userAdded: true,
      year, score, lot: form.lot.trim(), series: form.series, name: form.name.trim(),
      type: form.type || "Arabica", estate: form.estate, process: form.process,
      processDetail: form.processDetail || "—", field: form.field || "—",
      priceINR: form.priceINR || "—", priceUSD: form.priceUSD || "—",
      acidity: form.acidity || "—", body: form.body || "—",
      notes: form.notes || "—", date: form.date || "—", qty: form.qty || "—",
    };
    const updated = editId ? extraScores.map(r => r._id === editId ? rec : r) : [...extraScores, rec];
    setExtraScores(updated);
    localStorage.setItem("msp_extra_scores", JSON.stringify(updated));
    const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    setLastUpdated(now);
    localStorage.setItem("msp_last_updated", now);
    setModalOpen(false); setEditId(null);
  };

  const deleteScore = (id: string) => {
    if (!confirm("Delete this score entry?")) return;
    const updated = extraScores.filter(r => r._id !== id);
    setExtraScores(updated);
    localStorage.setItem("msp_extra_scores", JSON.stringify(updated));
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...BLANK_FORM, year: String(new Date().getFullYear()) });
    setModalOpen(true);
  };

  const changeTheme = (key: ThemeKey) => {
    setThemeKey(key); localStorage.setItem("msp_cup_theme", key); setPaletteOpen(false);
  };

  const theme = THEMES[themeKey];

  return (
    <div className={s.page} style={theme.vars as React.CSSProperties}>

      {/* HEADER */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.logo}>M</div>
          <div>
            <div className={s.headerTitle}>MSP Coffee P Ltd</div>
            <div className={s.headerSub}>Multi-Year Cup Score Catalogue</div>
          </div>
        </div>
        <div className={s.headerRight}>
          <div className={s.headerClock}>
            <div className={s.hclockTime}>{clockTime}</div>
            <div className={s.hclockDate}>{clockDate}</div>
            <div className={s.hclockUpdated}>↻ {lastUpdated}</div>
          </div>
          <div style={{ position: "relative" }}>
            <button className={s.paletteBtn} onClick={() => setPaletteOpen(p => !p)} title="Change colour theme">🎨</button>
            {paletteOpen && (
              <div className={s.palettePicker}>
                <div className={s.palettePickerTitle}>🎨 Colour Theme</div>
                {(Object.keys(THEMES) as ThemeKey[]).map(key => (
                  <div key={key} className={`${s.themeRow} ${themeKey === key ? s.themeRowActive : ""}`} onClick={() => changeTheme(key)}>
                    <div className={s.themeSwatch} style={{ background: THEMES[key].swatch }} />
                    <span className={s.themeName}>{THEMES[key].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={s.yearBadge}>☕ {fYear || "All Years"}</div>
          <button className={s.btnAddScore} onClick={openAdd}>＋ Add Score</button>
        </div>
      </div>

      {/* LEGEND */}
      <div className={s.legendBar}>
        <span className={s.legendTitle}>SCORE KEY:</span>
        {[
          { color: "#7c6d5a", label: "80–82.99 Good" },
          { color: "#3b82f6", label: "83–84.99 Very Good" },
          { color: "#059669", label: "85–86.99 Excellent" },
          { color: "#d97706", label: "87–88.99 Outstanding" },
          { color: "#dc2626", label: "89+ Exceptional" },
        ].map(({ color, label }) => (
          <div key={label} className={s.legendItem}>
            <div className={s.legendDot} style={{ background: color }} />{label}
          </div>
        ))}
      </div>

      {/* SUMMARY */}
      <div className={s.summary}>
        <div className={`${s.scard} ${s.scardGold}`}>
          <div className={s.scardIcon}>☕</div>
          <div className={s.scardLabel}>Total Lots Cupped</div>
          <div className={s.scardValue}>{summary.total}</div>
          <div className={s.scardSub}>{fYear || "2025"} Season</div>
        </div>
        <div className={`${s.scard} ${s.scardBlue}`}>
          <div className={s.scardIcon}>📊</div>
          <div className={s.scardLabel}>Average Cup Score</div>
          <div className={s.scardValue}>{summary.avg}</div>
          <div className={s.scardSub}>All lots</div>
        </div>
        <div className={`${s.scard} ${s.scardAmber}`}>
          <div className={s.scardIcon}>🏆</div>
          <div className={s.scardLabel}>Highest Score</div>
          <div className={s.scardValue}>{summary.top}</div>
          <div className={s.scardSub}>{summary.topLots}</div>
        </div>
        <div className={s.scard}>
          <div className={s.scardIcon}>⭐</div>
          <div className={s.scardLabel}>Outstanding+ (87+)</div>
          <div className={s.scardValue}>{summary.outstanding}</div>
          <div className={s.scardSub}>{summary.total ? ((summary.outstanding / summary.total) * 100).toFixed(0) : 0}% of all lots</div>
        </div>
        <div className={s.scard}>
          <div className={s.scardIcon}>🌿</div>
          <div className={s.scardLabel}>Estates</div>
          <div className={s.scardValue}>{summary.estateCount}</div>
          <div className={s.scardSub}>Yercaud, Tamil Nadu</div>
        </div>
        <div className={`${s.scard} ${s.scardGold}`}>
          <div className={s.scardIcon}>📅</div>
          <div className={s.scardLabel}>Years on Record</div>
          <div className={s.scardValue}>{summary.years.length}</div>
          <div className={s.scardSub}>{summary.years.join(" · ")}</div>
        </div>
      </div>

      {/* CHARTS */}
      <div className={s.chartsRow}>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>☕ Avg Score by Estate</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={estateChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis domain={[82, "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, "Avg Score"]} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {estateChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>📦 Lots by Process</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={processChartData} dataKey="value" cx="45%" cy="50%" innerRadius="36%" outerRadius="62%">
                  {processChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={s.chartCard}>
          <div className={s.chartTitle}>📊 Score Distribution</div>
          <div className={s.chartWrap}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={distChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, "Lots"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className={s.filters}>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Year</span>
          <select className={s.fsel} value={fYear} onChange={e => setFYear(e.target.value)}>
            <option value="">All Years</option>
            {availYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Estate</span>
          <select className={s.fsel} value={fEstate} onChange={e => setFEstate(e.target.value)}>
            <option value="">All Estates</option>
            {["Stanmore Estate","Moganad Estate","Orchardale Estate","Bison Valley Estate","Hidden Falls Estate"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Process</span>
          <select className={s.fsel} value={fProcess} onChange={e => setFProcess(e.target.value)}>
            <option value="">All Processes</option>
            {["Natural","Washed","Black Honey / PSD","Robusta"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Series</span>
          <select className={s.fsel} value={fSeries} onChange={e => setFSeries(e.target.value)}>
            <option value="">All Series</option>
            {["Gold Series","Small Batch","Nano Lot","Limited Edition"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className={s.filterGroup}>
          <span className={s.filterLabel}>Score</span>
          <select className={s.fsel} value={fScore} onChange={e => setFScore(e.target.value)}>
            <option value="">All Scores</option>
            <option value="85">85+</option>
            <option value="86">86+</option>
            <option value="87">87+</option>
            <option value="88">88+</option>
          </select>
        </div>
        <input className={s.fsearch} value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="🔍 Search taste notes, estate, process..." />
        <button className={s.btnClear} onClick={() => { setFEstate(""); setFProcess(""); setFSeries(""); setFScore(""); setFSearch(""); }}>✕ Clear</button>
        <span className={s.resultsCount}>{filteredData.length} of {COFFEES.length} lots</span>
      </div>

      {/* SORT */}
      <div className={s.sortRow}>
        <span className={s.sortLabel}>SORT:</span>
        {(["score","lot","estate","price"] as const).map(key => (
          <button key={key} className={`${s.sortBtn} ${sortBy === key ? s.sortBtnActive : ""}`} onClick={() => setSortBy(key)}>
            {key === "score" ? "Score ↓" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* GRID */}
      <div className={s.grid}>
        {filteredData.length === 0
          ? <div className={s.noResults}>No coffees match your filters.</div>
          : filteredData.map(c => <CoffeeCard key={(c._id || c.lot) + c.year} coffee={c} onDelete={deleteScore} />)
        }
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className={s.modal}>
            <div className={s.modalHdr}>
              <div className={s.modalHdrTitle}>{editId ? "✏️ Edit Cup Score" : "➕ Add New Cup Score"}</div>
              <button className={s.modalClose} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.formSectTitle}>📅 Year &amp; Lot</div>
              <div className={s.formGrid3}>
                <div className={s.formGroup}><label>Year *</label><input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2026" /></div>
                <div className={s.formGroup}><label>Lot No *</label><input type="text" value={form.lot} onChange={e => setForm(f => ({ ...f, lot: e.target.value }))} placeholder="e.g. 215" /></div>
                <div className={s.formGroup}><label>Series *</label>
                  <select value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))}>
                    {["Gold Series","Small Batch","Nano Lot","Limited Edition"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className={s.formSectTitle}>🌿 Coffee Details</div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Lot Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. GOLD SERIES NATURALS" /></div>
                <div className={s.formGroup}><label>Coffee Type</label><input type="text" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="e.g. Arabica Natural" /></div>
                <div className={s.formGroup}><label>Estate *</label>
                  <select value={form.estate} onChange={e => setForm(f => ({ ...f, estate: e.target.value }))}>
                    {["Stanmore Estate","Moganad Estate","Orchardale Estate","Bison Valley Estate","Hidden Falls Estate"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={s.formGroup}><label>Process</label>
                  <select value={form.process} onChange={e => setForm(f => ({ ...f, process: e.target.value }))}>
                    {["Natural","Washed","Black Honey / PSD","Robusta"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={s.formGroup}><label>Process Detail</label><input type="text" value={form.processDetail} onChange={e => setForm(f => ({ ...f, processDetail: e.target.value }))} placeholder="e.g. 48 Hrs Yeast Washed" /></div>
                <div className={s.formGroup}><label>Field / Block</label><input type="text" value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} placeholder="e.g. Meelish" /></div>
              </div>
              <div className={s.formSectTitle}>🏆 Score &amp; Pricing</div>
              <div className={s.formGrid3}>
                <div className={s.formGroup}><label>Cup Score *</label><input type="number" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="e.g. 86.75" step="0.25" /></div>
                <div className={s.formGroup}><label>Price (INR)</label><input type="text" value={form.priceINR} onChange={e => setForm(f => ({ ...f, priceINR: e.target.value }))} placeholder="e.g. ₹1,400" /></div>
                <div className={s.formGroup}><label>Price (USD FOB)</label><input type="text" value={form.priceUSD} onChange={e => setForm(f => ({ ...f, priceUSD: e.target.value }))} placeholder="e.g. $16.50" /></div>
              </div>
              <div className={s.formSectTitle}>☕ Cup Profile</div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Acidity</label><input type="text" value={form.acidity} onChange={e => setForm(f => ({ ...f, acidity: e.target.value }))} placeholder="e.g. Bright & Juicy" /></div>
                <div className={s.formGroup}><label>Body</label><input type="text" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="e.g. Silky, Medium+" /></div>
                <div className={s.formGroup}><label>Taste Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Blackberry, blueberry, oolong tea, honey" /></div>
                <div className={s.formGroup}><label>Date Cupped</label><input type="text" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} placeholder="e.g. 15 Mar 26" /></div>
              </div>
              <div className={s.formGrid}>
                <div className={s.formGroup}><label>Quantity (kg)</label><input type="text" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="e.g. 500 kg" /></div>
              </div>
            </div>
            <div className={s.modalFooter}>
              <button className={`${s.btnModal} ${s.btnCancel}`} onClick={() => setModalOpen(false)}>Cancel</button>
              <button className={`${s.btnModal} ${s.btnSave}`} onClick={saveScore}>💾 Save Score</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
