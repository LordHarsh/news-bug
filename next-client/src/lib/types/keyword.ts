/** One disease mention stored on an article document. */
export interface Keyword {
    location: string;
    keyword: string;
    caseCount: number;
    /** Absent when the location could not be geocoded. */
    latitude?: number;
    longitude?: number;
    needsGeocode?: boolean;
}

/** A map/table row: one (keyword, location) outbreak for a time bucket. */
export interface KeywordDetails {
    _id: number;
    keyword: string;
    caseCount: number;
    location: string;
    latitude: number;
    longitude: number;
    /** Every article reporting this outbreak, newest coverage last. */
    articleId: string[];
    sourceId: string[];
    date: Date;
}
