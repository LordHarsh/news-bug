export interface Keyword {
    location: string;
    keyword: string;
    caseCount: number;
    latitude: number;
    longitude: number;
}

export interface KeywordDetails {
    _id: number;
    keyword: number;
    caseCount: number;
    location: string[];
    latitude: number;
    longitude: number;
    articleId: string[];
    sourceId: string[];
    date: Date;
}