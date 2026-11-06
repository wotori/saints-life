export type TraditionId = 'russian-orthodox' | 'old-believer';
export type CalendarSystem = 'gregorian' | 'julian';
export type CivilDate = { year: number; month: number; day: number };

export interface Saint {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  rank: string;
  lifespan?: string;
  place?: string;
  intro?: string;
  featured?: number;
  sourceId: string;
  sourceLocator: string;
}

// Recognition is a sourced assertion, never an intrinsic boolean on a person.
export interface Veneration {
  saintId: string;
  traditionId: TraditionId;
  sourceId: string;
  note: string;
}

export interface Commemoration {
  id: string;
  saintId: string;
  traditionId: TraditionId;
  sourceId: string;
  label: string;
  rule:
    | { kind: 'fixed'; calendar: CalendarSystem; month: number; day: number; nonLeapDay?: number }
    | { kind: 'after-nativity'; calendar: 'julian' }
    | { kind: 'forefathers'; calendar: 'julian' }
    | { kind: 'cheesefare-saturday'; calendar: 'julian' }
    | { kind: 'second-sunday-lent'; calendar: 'julian' }
    | { kind: 'second-sunday-after-pentecost'; calendar: 'julian' }
    | { kind: 'myrrhbearers'; calendar: 'julian' }
    | { kind: 'unresolved'; note: string };
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: 'directory' | 'calendar' | 'article' | 'book' | 'liturgy';
  traditionId?: TraditionId;
  accessedAt: string;
  rights: string;
  note: string;
}

export interface Work {
  id: string;
  title: string;
  author: string;
  kind: 'editorial' | 'hagiography' | 'article' | 'liturgy';
}

export interface Edition {
  id: string;
  workId: string;
  publisher: string;
  language: string;
  publication: string;
  sourceIds: string[];
  rights: 'original-editorial' | 'external-only';
  note: string;
}

export interface Reading {
  id: string;
  saintId: string;
  editionId: string;
  title: string;
  mode: 'summary' | 'external';
  sections: { title: string; paragraphs: string[] }[];
}
