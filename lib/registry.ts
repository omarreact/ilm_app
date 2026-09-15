import type { Portal } from "./types";

export const PORTALS: Portal[] = [
  {
    "id": "e-amarseba-online",
    "domain": "e-amarseba.online",
    "url": "https://e-amarseba.online/",
    "risk": "unverified",
    "research": {
      "type": "Member / agent portal",
      "risk": "unverified",
      "summary": "Public member-login portal with registration and WhatsApp support observed in research.",
      "claims": ["member login", "registration", "WhatsApp support"],
      "channels": ["WhatsApp"],
      "sources": ["https://e-amarseba.online/"]
    }
  },
  {
    "id": "bddigitalshop-uk",
    "domain": "bddigitalshop.uk",
    "url": "https://bddigitalshop.uk/",
    "risk": "elevated",
    "research": {
      "type": "Prepaid member / agent portal",
      "risk": "elevated",
      "summary": "Login-gated portal. Public registration page stated direct signup was closed and new activation required a fixed recharge plus WhatsApp application.",
      "claims": ["login", "registration by application", "fixed account activation recharge"],
      "channels": ["WhatsApp"],
      "payments": ["prepaid wallet/recharge"],
      "sources": ["https://bddigitalshop.uk/", "https://bddigitalshop.uk/register.php"]
    }
  },
  {
    "id": "bddigitalshop-com",
    "domain": "bddigitalshop.com",
    "url": "https://bddigitalshop.com/",
    "risk": "elevated",
    "research": {
      "type": "Redirect / related domain",
      "risk": "elevated",
      "summary": "Observed redirect from .com into the bddigitalshop.uk login portal.",
      "claims": ["redirect to .uk login"],
      "relations": ["bddigitalshop.uk"],
      "sources": ["https://bddigitalshop.com/", "https://bddigitalshop.uk/"]
    }
  },
  {
    "id": "land-eporchas",
    "domain": "land.eporchas.com",
    "url": "https://land.eporchas.com/",
    "risk": "unverified",
    "research": {
      "type": "Land information intermediary",
      "risk": "unverified",
      "summary": "Public land portal advertising land/porcha search and premium registration. Parent ePorchas pages advertise mobile/bank payments and state that they are not a government website.",
      "claims": ["land search", "khatian/dag/name search", "premium registration", "porcha services"],
      "payments": ["bKash", "Nagad", "bank"],
      "sources": ["https://land.eporchas.com/", "https://www.eporchas.com/get-eporchas-land", "https://www.eporchas.com/land-data-eporchas.html"]
    }
  },
  {
    "id": "union-seba",
    "domain": "union-seba.site",
    "url": "https://union-seba.site/",
    "risk": "unverified",
    "research": {
      "type": "Union service portal",
      "risk": "unverified",
      "summary": "Seed intelligence describes union certificate services; current public catalogue was not reliably retrievable in the deep-research pass.",
      "claims": ["union certificates (seed intelligence)"],
      "sources": ["https://union-seba.site/"]
    }
  },
  {
    "id": "sebazone",
    "domain": "sebazone.xyz",
    "url": "https://sebazone.xyz/",
    "risk": "unverified",
    "research": {
      "type": "Member / agent portal",
      "risk": "unverified",
      "summary": "Public site exposes registration/referral routing and a Telegram channel link.",
      "claims": ["login/register", "agent/community model"],
      "channels": ["Telegram"],
      "sources": ["https://sebazone.xyz/", "https://t.me/Seba_Zone"]
    }
  },
  {
    "id": "nidseba",
    "domain": "nidseba.me",
    "url": "https://nidseba.me/",
    "risk": "high",
    "research": {
      "type": "High-risk data/document service claims",
      "risk": "high",
      "summary": "Seed and prior public observations associate this portal with NID-related services and sensitive-data claims. Treat service capability as a website claim unless independently corroborated.",
      "claims": ["NID copies", "call-list claims", "MFS information claims", "location claims"],
      "highRiskIndicators": ["NID lookup/copy", "CDR/call-list", "MFS data", "location data"],
      "sources": ["https://nidseba.me/"]
    }
  },
  {
    "id": "nidmaker",
    "domain": "nidmaker.com",
    "url": "https://nidmaker.com/",
    "risk": "high",
    "research": {
      "type": "Paid NID document intermediary",
      "risk": "high",
      "summary": "Public pages advertise NID server-copy PDF workflows and payment/order forms. Public pay page requests NID number, date of birth, contact details and payment reference.",
      "claims": ["NID server copy", "form-number/voter-number workflow", "paid order form"],
      "payments": ["bKash", "Nagad", "Rocket"],
      "channels": ["Telegram/online support observed in public links"],
      "highRiskIndicators": ["identity document handling"],
      "sources": ["https://nidmaker.com/", "https://nidmaker.com/pay/", "https://nidmaker.com/form-number-to-nid/", "https://nidmaker.com/nid-by-voter-number/"]
    }
  },
  {
    "id": "sebahub",
    "domain": "sebahub.org",
    "url": "https://sebahub.org/",
    "risk": "unverified",
    "research": {
      "type": "Login-gated member portal",
      "risk": "unverified",
      "summary": "Root redirects to a login page with registration and password-reset links. Authenticated service catalogue was not accessed.",
      "claims": ["login", "registration", "password reset", "dashboard route"],
      "sources": ["https://sebahub.org/", "https://sebahub.org/register.php"]
    }
  },
  {
    "id": "my-union-seba",
    "domain": "my-union-seba.space",
    "url": "https://my-union-seba.space/",
    "risk": "unverified",
    "research": {
      "type": "Union / civic service platform",
      "risk": "unverified",
      "summary": "Public page advertises 45+ citizen services, login/registration, certificate verification, tax-related routes and digital service workflow.",
      "claims": ["45+ citizen services", "warish/inheritance", "trade licence", "citizenship/character certificate", "holding tax", "certificate verification"],
      "sources": ["https://my-union-seba.space/", "https://my-union-seba.space/verify.php", "https://my-union-seba.space/tax.php"]
    }
  },
  {
    "id": "amarsheba",
    "domain": "amarsheba.com.bd",
    "url": "https://amarsheba.com.bd/",
    "risk": "low",
    "research": {
      "type": "Union / municipality management platform",
      "risk": "low",
      "summary": "Public site advertises certificate, trade-licence, holding-tax, OCR/autofill and QR verification workflows for local-government/citizen services.",
      "claims": ["union/municipality certificates", "trade licence", "holding tax", "NID OCR/autofill", "QR verification"],
      "sources": ["https://amarsheba.com.bd/", "https://amarsheba.com.bd/login"]
    }
  },
  {
    "id": "e-amarseba-com",
    "domain": "e-amarseba.com",
    "url": "https://e-amarseba.com/",
    "risk": "low",
    "research": {
      "type": "Digital-centre / e-service platform",
      "risk": "low",
      "summary": "Public catalogue includes Union/municipality certificates, Teletalk payment, AFIS-related application assistance, voter-related application forms, bulk/location SMS, QR and software tools.",
      "claims": ["union/municipality certificates", "Teletalk payment", "AFIS matching application", "voter application assistance", "Bulk SMS", "Location SMS", "QR/software tools"],
      "payments": ["Nagad", "Surjopay", "Upay (FAQ claim)"],
      "sources": ["https://e-amarseba.com/", "https://e-amarseba.com/services", "https://e-amarseba.com/page/faq"]
    }
  },
  {
    "id": "sonod",
    "domain": "sonod.com.bd",
    "url": "https://sonod.com.bd/",
    "risk": "low",
    "research": {
      "type": "Digital certificate platform",
      "risk": "low",
      "summary": "Public platform for citizen certificate application, office approval, tracking, trade licence, holding tax, OCR, QR verification and payments.",
      "claims": ["certificates", "trade licence", "holding tax", "OCR", "QR verification", "application tracking", "payments"],
      "sources": ["https://sonod.com.bd/"]
    }
  },
  {
    "id": "ekappbd",
    "domain": "ekappbd.com",
    "url": "https://ekappbd.com/",
    "risk": "low",
    "research": {
      "type": "Citizen / entrepreneur service platform",
      "risk": "low",
      "summary": "Public platform for government/private service assistance, certificates, registrations, payments, bookkeeping and citizen/entrepreneur/admin roles.",
      "claims": ["certificates", "registrations", "payments", "bookkeeping", "SMS", "bill payment", "recharge", "ticketing"],
      "sources": ["https://ekappbd.com/", "https://ekappbd.com/auth/signup"]
    }
  },
  {
    "id": "bd-seba",
    "domain": "bd-seba.xyz",
    "url": "https://bd-seba.xyz/",
    "risk": "unverified",
    "research": {
      "type": "Inactive / uncertain portal",
      "risk": "unverified",
      "summary": "Prior research returned gateway/availability failures. Treat current state as unknown until a new live observation succeeds.",
      "claims": ["login/register (seed intelligence)"],
      "sources": ["https://bd-seba.xyz/"]
    }
  },
  {
    "id": "sebabd",
    "domain": "sebabd.xyz",
    "url": "https://sebabd.xyz/",
    "risk": "unverified",
    "research": {
      "type": "Suspended / inactive portal",
      "risk": "unverified",
      "summary": "A public check observed an account-suspended hosting page; status may change and should be revalidated.",
      "claims": ["historical login portal"],
      "sources": ["https://sebabd.xyz/"]
    }
  },
  {
    "id": "e-seba-24",
    "domain": "E Seba 24 Dot Top (hostname unspecified)",
    "url": null,
    "risk": "high",
    "research": {
      "type": "Law-enforcement reported data-sale operation",
      "risk": "high",
      "summary": "RAB said an operation called “E Seba 24 Dot Top” sold NID/birth records, CDRs, mobile-banking records, SIM ownership, IMEI and location data. Exact hostname was not supplied, so this dashboard does not guess it.",
      "claims": ["RAB allegation: NID/birth records", "RAB allegation: CDR", "RAB allegation: MFS records", "RAB allegation: SIM ownership", "RAB allegation: IMEI", "RAB allegation: location"],
      "channels": ["Facebook promotion (RAB allegation)", "WhatsApp orders (RAB allegation)"],
      "highRiskIndicators": ["CDR", "MFS records", "SIM ownership", "IMEI", "location"],
      "sources": ["https://www.thedailystar.net/news/bangladesh/news/five-held-over-sale-govt-data-4272141", "https://www.thedailystar.net/news/crime-justice/cybercrime-and-scams/news/rab-arrests-5-allegedly-selling-personal-data-govt-servers-4271946"]
    }
  }
] as Portal[];

export const PORTAL_BY_ID = new Map(PORTALS.map((portal) => [portal.id, portal]));

export const HOST_ALLOWLIST = new Set(
  PORTALS
    .map((portal) => portal.url)
    .filter((url): url is string => Boolean(url))
    .map((url) => new URL(url).hostname.toLowerCase())
);
