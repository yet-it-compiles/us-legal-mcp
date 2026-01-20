export declare const API_ENDPOINTS: {
    readonly CONGRESS: "https://api.congress.gov/v3";
    readonly FEDERAL_REGISTER: "https://www.federalregister.gov/api/v1";
    readonly US_CODE: "https://uscode.house.gov/api";
    readonly REGULATIONS_GOV: "https://api.regulations.gov/v4";
    readonly GPO: "https://api.govinfo.gov";
    readonly COURT_LISTENER: "https://www.courtlistener.com/api/rest/v3";
};
export interface CongressBill {
    congress: number;
    type: string;
    number: number;
    title: string;
    shortTitle?: string;
    summary?: string;
    url: string;
    introducedDate: string;
    latestAction?: {
        actionDate: string;
        text: string;
    };
    subjects?: string[];
    sponsors?: Array<{
        bioguideId: string;
        firstName: string;
        lastName: string;
        party: string;
        state: string;
    }>;
}
export interface FederalRegisterDocument {
    document_number: string;
    title: string;
    abstract?: string;
    publication_date: string;
    effective_date?: string;
    agency_names: string[];
    document_type: string;
    pdf_url: string;
    html_url: string;
    json_url: string;
    sections?: Array<{
        title: string;
        content: string;
    }>;
}
export interface USCodeSection {
    title: number;
    section: string;
    text: string;
    url: string;
    last_updated: string;
    source: string;
}
export interface RegulationComment {
    id: string;
    comment: string;
    posted_date: string;
    agency_id: string;
    document_id: string;
    submitter_name?: string;
    organization?: string;
}
export interface CourtOpinion {
    id: number;
    case_name: string;
    case_name_full?: string;
    date_filed: string;
    date_modified?: string;
    court: string;
    court_id: number;
    jurisdiction: string;
    citation?: string;
    citation_count?: number;
    precedential_status: string;
    url: string;
    absolute_url: string;
    download_url?: string;
    plain_text?: string;
    html?: string;
    html_lawbox?: string;
    html_columbia?: string;
    html_anon_2020?: string;
    judges?: string[];
    docket?: string;
    docket_number?: string;
    slug?: string;
}
export interface CongressVote {
    rollNumber: number;
    url: string;
    voteDate: string;
    voteQuestion: string;
    voteResult: string;
    voteTitle: string;
    voteType: string;
    chamber: string;
    congress: number;
    session: number;
    members?: Array<{
        member: {
            bioguideId: string;
            firstName: string;
            lastName: string;
            party: string;
            state: string;
        };
        votePosition: string;
    }>;
}
export interface Committee {
    systemCode: string;
    name: string;
    url: string;
    chamber?: string;
    committeeType?: string;
    subcommittees?: Array<{
        systemCode: string;
        name: string;
        url: string;
    }>;
}
export declare class CongressAPI {
    private apiKey;
    constructor(apiKey?: string);
    searchBills(query: string, congress?: number, limit?: number): Promise<CongressBill[]>;
    getBillDetails(congress: number, billType: string, billNumber: number): Promise<CongressBill | null>;
    getRecentBills(congress?: number, limit?: number): Promise<CongressBill[]>;
    searchVotes(congress?: number, chamber?: "House" | "Senate", limit?: number): Promise<CongressVote[]>;
    getCommittees(congress?: number, chamber?: "House" | "Senate"): Promise<Committee[]>;
}
export declare class FederalRegisterAPI {
    searchDocuments(query: string, limit?: number): Promise<FederalRegisterDocument[]>;
    getRecentDocuments(limit?: number): Promise<FederalRegisterDocument[]>;
    getDocumentDetails(documentNumber: string): Promise<FederalRegisterDocument | null>;
}
export declare class USCodeAPI {
    searchCode(query: string, title?: number, limit?: number): Promise<USCodeSection[]>;
    getSection(title: number, section: string): Promise<USCodeSection | null>;
}
export declare class CourtListenerAPI {
    private apiKey?;
    constructor(apiKey?: string);
    searchOpinions(query: string, court?: string, limit?: number): Promise<CourtOpinion[]>;
    getRecentOpinions(court?: string, limit?: number): Promise<CourtOpinion[]>;
    getOpinion(opinionId: number): Promise<CourtOpinion | null>;
}
export declare class RegulationsGovAPI {
    private apiKey;
    constructor(apiKey?: string);
    searchComments(query: string, limit?: number): Promise<RegulationComment[]>;
}
export declare class USLegalAPI {
    congress: CongressAPI;
    federalRegister: FederalRegisterAPI;
    usCode: USCodeAPI;
    regulations: RegulationsGovAPI;
    courtListener: CourtListenerAPI;
    constructor(apiKeys?: {
        congress?: string;
        regulationsGov?: string;
        courtListener?: string;
    });
    searchAll(query: string, limit?: number): Promise<{
        bills: CongressBill[];
        regulations: FederalRegisterDocument[];
        codeSections: USCodeSection[];
        comments: RegulationComment[];
    }>;
}
export default USLegalAPI;
//# sourceMappingURL=us-legal-apis.d.ts.map