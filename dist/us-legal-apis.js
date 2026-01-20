// US Legal APIs Integration
// Comprehensive integration with US government legal data sources
import axios from "axios";
// Relevance scoring utilities
function calculateRelevanceScore(text, query) {
    if (!text || !query)
        return 0;
    const lowerText = text.toLowerCase();
    const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2);
    if (queryTerms.length === 0)
        return 0;
    let score = 0;
    const exactMatch = lowerText.includes(query.toLowerCase());
    if (exactMatch)
        score += 10;
    // Count how many query terms appear
    let matchedTerms = 0;
    for (const term of queryTerms) {
        if (lowerText.includes(term)) {
            matchedTerms++;
            // Bonus for term appearing multiple times
            const occurrences = (lowerText.match(new RegExp(term, "g")) || []).length;
            score += Math.min(occurrences, 3);
        }
    }
    // Bonus for all terms matching
    if (matchedTerms === queryTerms.length)
        score += 5;
    // Bonus for title/short title match (handled in specific scoring functions)
    return score;
}
function scoreBillRelevance(bill, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((term) => term.length > 2);
    // High weight for title matches
    if (bill.title) {
        const titleScore = calculateRelevanceScore(bill.title, query);
        score += titleScore * 4; // Increased from 3
    }
    if (bill.shortTitle) {
        const shortTitleScore = calculateRelevanceScore(bill.shortTitle, query);
        score += shortTitleScore * 4; // Increased from 3
    }
    // Medium weight for summary
    if (bill.summary?.text) {
        score += calculateRelevanceScore(bill.summary.text, query) * 2;
    }
    // Check latest action text
    if (bill.latestAction?.text) {
        const actionScore = calculateRelevanceScore(bill.latestAction.text, query);
        score += actionScore * 1.5;
    }
    // Enhanced subject/topic matching - check each query term individually
    if (bill.subjects && queryTerms.length > 0) {
        for (const subject of bill.subjects) {
            const subjectName = (typeof subject === "string" ? subject : subject.name || "").toLowerCase();
            // Check if any query term matches the subject
            for (const term of queryTerms) {
                if (subjectName.includes(term)) {
                    score += 20; // Increased from 15
                    break; // Only count once per subject
                }
            }
        }
    }
    return score;
}
function scoreDocumentRelevance(doc, query) {
    let score = 0;
    // High weight for title
    if (doc.title) {
        score += calculateRelevanceScore(doc.title, query) * 3;
    }
    // Medium weight for abstract
    if (doc.abstract) {
        score += calculateRelevanceScore(doc.abstract, query) * 2;
    }
    // Check agency names for relevance by matching query terms against agency names
    if (doc.agency_names && Array.isArray(doc.agency_names)) {
        const queryTerms = query
            .toLowerCase()
            .split(/\s+/)
            .filter((term) => term.length > 2);
        for (const agency of doc.agency_names) {
            const agencyLower = agency.toLowerCase();
            // Check if any query term appears in the agency name
            const agencyMatch = queryTerms.some((term) => agencyLower.includes(term));
            if (agencyMatch) {
                score += 10;
            }
        }
    }
    return score;
}
// API Base URLs
export const API_ENDPOINTS = {
    CONGRESS: "https://api.congress.gov/v3",
    FEDERAL_REGISTER: "https://www.federalregister.gov/api/v1",
    US_CODE: "https://uscode.house.gov/api",
    REGULATIONS_GOV: "https://api.regulations.gov/v4",
    GPO: "https://api.govinfo.gov",
    COURT_LISTENER: "https://www.courtlistener.com/api/rest/v3",
};
// Congress.gov API Functions
export class CongressAPI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.CONGRESS_API_KEY || "";
    }
    async searchBills(query, congress, limit = 20) {
        try {
            // Get more results than needed for filtering (increased for better relevance)
            const fetchLimit = Math.min(limit * 5, 250);
            const params = new URLSearchParams({
                q: query,
                limit: fetchLimit.toString(),
                format: "json",
                ...(this.apiKey && { api_key: this.apiKey }),
                ...(congress && { congress: congress.toString() }),
            });
            const response = await axios.get(`${API_ENDPOINTS.CONGRESS}/bill?${params}`);
            const bills = (response.data.bills || []).map((bill) => ({
                congress: bill.congress,
                type: bill.type,
                number: bill.number,
                title: bill.title,
                shortTitle: bill.shortTitle,
                summary: bill.summary?.text,
                url: bill.url,
                introducedDate: bill.introducedDate,
                latestAction: bill.latestAction
                    ? {
                        actionDate: bill.latestAction.actionDate,
                        text: bill.latestAction.text,
                    }
                    : undefined,
                subjects: bill.subjects?.map((s) => s.name || s),
                sponsors: bill.sponsors?.map((s) => ({
                    bioguideId: s.bioguideId,
                    firstName: s.firstName,
                    lastName: s.lastName,
                    party: s.party,
                    state: s.state,
                })),
            }));
            // Score and sort by relevance
            const scoredBills = bills.map((bill) => ({
                ...bill,
                relevanceScore: scoreBillRelevance(bill, query),
            }));
            // Sort by relevance (highest first)
            scoredBills.sort((a, b) => b.relevanceScore - a.relevanceScore);
            // Log scoring for debugging (first few bills)
            if (scoredBills.length > 0) {
                console.error(`Congress Bills Relevance Scores (top 5): ${scoredBills
                    .slice(0, 5)
                    .map((b) => `${b.title.substring(0, 40)}... (score: ${b.relevanceScore})`)
                    .join(", ")}`);
            }
            // Use smart filtering: prioritize high-scoring bills but always return top results
            // Only filter if we have many high-scoring options
            const highRelevanceBills = scoredBills.filter((bill) => bill.relevanceScore >= 5);
            if (highRelevanceBills.length >= limit) {
                // We have enough high-relevance results, return those
                return highRelevanceBills
                    .slice(0, limit)
                    .map(({ relevanceScore, ...bill }) => bill);
            }
            else if (scoredBills.length > 0) {
                // Return top results sorted by relevance, even if scores are low
                // This ensures we always return something if the API returned results
                return scoredBills
                    .slice(0, limit)
                    .map(({ relevanceScore, ...bill }) => bill);
            }
            return [];
        }
        catch (error) {
            console.error("Congress API error:", error);
            return [];
        }
    }
    async getBillDetails(congress, billType, billNumber) {
        try {
            const params = new URLSearchParams({
                format: "json",
                ...(this.apiKey && { api_key: this.apiKey }),
            });
            const response = await axios.get(`${API_ENDPOINTS.CONGRESS}/bill/${congress}/${billType}/${billNumber}?${params}`);
            const bill = response.data.bill;
            return {
                congress: bill.congress,
                type: bill.type,
                number: bill.number,
                title: bill.title,
                shortTitle: bill.shortTitle,
                summary: bill.summary?.text,
                url: bill.url,
                introducedDate: bill.introducedDate,
                latestAction: bill.latestAction
                    ? {
                        actionDate: bill.latestAction.actionDate,
                        text: bill.latestAction.text,
                    }
                    : undefined,
                subjects: bill.subjects?.map((s) => s.name),
                sponsors: bill.sponsors?.map((s) => ({
                    bioguideId: s.bioguideId,
                    firstName: s.firstName,
                    lastName: s.lastName,
                    party: s.party,
                    state: s.state,
                })),
            };
        }
        catch (error) {
            console.error("Congress API error:", error);
            return null;
        }
    }
    async getRecentBills(congress, limit = 20) {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                format: "json",
                ...(this.apiKey && { api_key: this.apiKey }),
                ...(congress && { congress: congress.toString() }),
            });
            const response = await axios.get(`${API_ENDPOINTS.CONGRESS}/bill?${params}`);
            return (response.data.bills?.map((bill) => ({
                congress: bill.congress,
                type: bill.type,
                number: bill.number,
                title: bill.title,
                shortTitle: bill.shortTitle,
                summary: bill.summary?.text,
                url: bill.url,
                introducedDate: bill.introducedDate,
                latestAction: bill.latestAction
                    ? {
                        actionDate: bill.latestAction.actionDate,
                        text: bill.latestAction.text,
                    }
                    : undefined,
                subjects: bill.subjects?.map((s) => s.name),
                sponsors: bill.sponsors?.map((s) => ({
                    bioguideId: s.bioguideId,
                    firstName: s.firstName,
                    lastName: s.lastName,
                    party: s.party,
                    state: s.state,
                })),
            })) || []);
        }
        catch (error) {
            console.error("Congress API error:", error);
            return [];
        }
    }
    async searchVotes(congress, chamber, limit = 20) {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                format: "json",
                ...(this.apiKey && { api_key: this.apiKey }),
                ...(congress && { congress: congress.toString() }),
                ...(chamber && { chamber }),
            });
            const response = await axios.get(`${API_ENDPOINTS.CONGRESS}/vote?${params}`);
            return (response.data.votes?.map((vote) => ({
                rollNumber: vote.rollNumber,
                url: vote.url,
                voteDate: vote.voteDate,
                voteQuestion: vote.voteQuestion,
                voteResult: vote.voteResult,
                voteTitle: vote.voteTitle,
                voteType: vote.voteType,
                chamber: vote.chamber,
                congress: vote.congress,
                session: vote.session,
                members: vote.members?.map((m) => ({
                    member: {
                        bioguideId: m.member?.bioguideId,
                        firstName: m.member?.firstName,
                        lastName: m.member?.lastName,
                        party: m.member?.party,
                        state: m.member?.state,
                    },
                    votePosition: m.votePosition,
                })),
            })) || []);
        }
        catch (error) {
            if (error.response?.status === 403) {
                console.error("Congress API: API key required for votes/committees. Get one at https://api.congress.gov/");
            }
            else {
                console.error("Congress API error:", error.message || error);
            }
            return [];
        }
    }
    async getCommittees(congress, chamber) {
        try {
            const params = new URLSearchParams({
                format: "json",
                ...(this.apiKey && { api_key: this.apiKey }),
                ...(congress && { congress: congress.toString() }),
                ...(chamber && { chamber }),
            });
            const response = await axios.get(`${API_ENDPOINTS.CONGRESS}/committee?${params}`);
            return (response.data.committees?.map((committee) => ({
                systemCode: committee.systemCode,
                name: committee.name,
                url: committee.url,
                chamber: committee.chamber,
                committeeType: committee.committeeType,
                subcommittees: committee.subcommittees?.map((sub) => ({
                    systemCode: sub.systemCode,
                    name: sub.name,
                    url: sub.url,
                })),
            })) || []);
        }
        catch (error) {
            if (error.response?.status === 403) {
                console.error("Congress API: API key required for votes/committees. Get one at https://api.congress.gov/");
            }
            else {
                console.error("Congress API error:", error.message || error);
            }
            return [];
        }
    }
}
// Federal Register API Functions
export class FederalRegisterAPI {
    async searchDocuments(query, limit = 20) {
        try {
            // Get more results than needed for filtering
            const fetchLimit = Math.min(limit * 3, 100);
            const params = new URLSearchParams({
                q: query,
                per_page: fetchLimit.toString(),
                order: "relevance",
            });
            const response = await axios.get(`${API_ENDPOINTS.FEDERAL_REGISTER}/documents?${params}`);
            const documents = (response.data.results || []).map((doc) => ({
                document_number: doc.document_number,
                title: doc.title,
                abstract: doc.abstract,
                publication_date: doc.publication_date,
                effective_date: doc.effective_date,
                agency_names: doc.agency_names,
                document_type: doc.document_type,
                pdf_url: doc.pdf_url,
                html_url: doc.html_url,
                json_url: doc.json_url,
            }));
            // Score and sort by relevance
            const scoredDocs = documents.map((doc) => ({
                ...doc,
                relevanceScore: scoreDocumentRelevance(doc, query),
            }));
            // Sort by relevance (highest first)
            scoredDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
            // Filter out very low relevance results (score < 5) and return top results
            const relevantDocs = scoredDocs
                .filter((doc) => doc.relevanceScore >= 5)
                .slice(0, limit)
                .map(({ relevanceScore, ...doc }) => doc); // Remove score from output
            // If we filtered out too many, return the top results even if low score
            if (relevantDocs.length < limit && scoredDocs.length > 0) {
                return scoredDocs
                    .slice(0, limit)
                    .map(({ relevanceScore, ...doc }) => doc);
            }
            return relevantDocs;
        }
        catch (error) {
            console.error("Federal Register API error:", error);
            return [];
        }
    }
    async getRecentDocuments(limit = 20) {
        try {
            const params = new URLSearchParams({
                per_page: limit.toString(),
                order: "newest",
            });
            const response = await axios.get(`${API_ENDPOINTS.FEDERAL_REGISTER}/documents?${params}`);
            return (response.data.results?.map((doc) => ({
                document_number: doc.document_number,
                title: doc.title,
                abstract: doc.abstract,
                publication_date: doc.publication_date,
                effective_date: doc.effective_date,
                agency_names: doc.agency_names,
                document_type: doc.document_type,
                pdf_url: doc.pdf_url,
                html_url: doc.html_url,
                json_url: doc.json_url,
            })) || []);
        }
        catch (error) {
            console.error("Federal Register API error:", error);
            return [];
        }
    }
    async getDocumentDetails(documentNumber) {
        try {
            const response = await axios.get(`${API_ENDPOINTS.FEDERAL_REGISTER}/documents/${documentNumber}.json`);
            const doc = response.data;
            return {
                document_number: doc.document_number,
                title: doc.title,
                abstract: doc.abstract,
                publication_date: doc.publication_date,
                effective_date: doc.effective_date,
                agency_names: doc.agency_names,
                document_type: doc.document_type,
                pdf_url: doc.pdf_url,
                html_url: doc.html_url,
                json_url: doc.json_url,
                sections: doc.sections?.map((s) => ({
                    title: s.title,
                    content: s.content,
                })),
            };
        }
        catch (error) {
            console.error("Federal Register API error:", error);
            return null;
        }
    }
}
// US Code API Functions
export class USCodeAPI {
    async searchCode(query, title, limit = 20) {
        try {
            const params = new URLSearchParams({
                q: query,
                limit: limit.toString(),
                ...(title && { title: title.toString() }),
            });
            // Add timeout and retry logic for US Code API
            const response = await axios.get(`${API_ENDPOINTS.US_CODE}/search?${params}`, {
                timeout: 30000, // 30 second timeout
                validateStatus: (status) => status < 500, // Don't throw on 4xx
            });
            // Handle API errors gracefully
            if (response.status >= 400) {
                console.error(`US Code API error: ${response.status} - ${response.statusText}`);
                return [];
            }
            return (response.data.results?.map((section) => ({
                title: section.title,
                section: section.section,
                text: section.text,
                url: section.url,
                last_updated: section.last_updated,
                source: section.source,
            })) || []);
        }
        catch (error) {
            if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
                console.error("US Code API: Connection timeout. The API may be temporarily unavailable.");
            }
            else if (error.code === "ECONNREFUSED") {
                console.error("US Code API: Connection refused. The API endpoint may be down.");
            }
            else {
                console.error("US Code API error:", error.message || error);
            }
            return [];
        }
    }
    async getSection(title, section) {
        try {
            const response = await axios.get(`${API_ENDPOINTS.US_CODE}/title/${title}/section/${section}`);
            const data = response.data;
            return {
                title: data.title,
                section: data.section,
                text: data.text,
                url: data.url,
                last_updated: data.last_updated,
                source: data.source,
            };
        }
        catch (error) {
            console.error("US Code API error:", error);
            return null;
        }
    }
}
// CourtListener API Functions
export class CourtListenerAPI {
    apiKey;
    constructor(apiKey) {
        // CourtListener API doesn't require key but has rate limits without one
        this.apiKey = apiKey || process.env.COURT_LISTENER_API_KEY;
    }
    async searchOpinions(query, court, limit = 20) {
        try {
            const params = new URLSearchParams({
                q: query,
                type: "o", // 'o' for opinions
                page_size: limit.toString(),
                ordering: "-date_filed",
                ...(court && { court: court }),
            });
            const headers = {
                Accept: "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Token ${this.apiKey}`;
            }
            const response = await axios.get(`${API_ENDPOINTS.COURT_LISTENER}/search/`, { params, headers });
            return (response.data.results?.map((opinion) => {
                const absoluteUrl = opinion.absoluteUrl ||
                    opinion.absolute_url ||
                    (opinion.id
                        ? `https://www.courtlistener.com/opinion/${opinion.id}/`
                        : undefined);
                return {
                    id: opinion.id,
                    case_name: opinion.caseName || opinion.case_name,
                    case_name_full: opinion.caseNameFull || opinion.case_name_full,
                    date_filed: opinion.dateFiled || opinion.date_filed,
                    date_modified: opinion.dateModified || opinion.date_modified,
                    court: opinion.court || opinion.court_name,
                    court_id: opinion.courtId || opinion.court_id,
                    jurisdiction: opinion.jurisdiction,
                    citation: opinion.citation,
                    citation_count: opinion.citationCount || opinion.citation_count,
                    precedential_status: opinion.precedentialStatus || opinion.precedential_status,
                    url: absoluteUrl,
                    absolute_url: absoluteUrl,
                    download_url: opinion.downloadUrl || opinion.download_url,
                    plain_text: opinion.plainText || opinion.plain_text,
                    html: opinion.html,
                    html_lawbox: opinion.htmlLawbox || opinion.html_lawbox,
                    html_columbia: opinion.htmlColumbia || opinion.html_columbia,
                    html_anon_2020: opinion.htmlAnon2020 || opinion.html_anon_2020,
                    judges: opinion.judges,
                    docket: opinion.docket,
                    docket_number: opinion.docketNumber || opinion.docket_number,
                    slug: opinion.slug,
                };
            }) || []);
        }
        catch (error) {
            if (error.response?.status === 403) {
                console.error("CourtListener API: API key required. Get one at https://www.courtlistener.com/api/");
            }
            else {
                console.error("CourtListener API error:", error.message || error);
            }
            return [];
        }
    }
    async getRecentOpinions(court, limit = 20) {
        try {
            const params = new URLSearchParams({
                type: "o", // 'o' for opinions
                page_size: limit.toString(),
                ordering: "-date_filed",
                ...(court && { court: court }),
            });
            const headers = {
                Accept: "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Token ${this.apiKey}`;
            }
            const response = await axios.get(`${API_ENDPOINTS.COURT_LISTENER}/search/`, { params, headers });
            return (response.data.results?.map((opinion) => {
                const absoluteUrl = opinion.absoluteUrl ||
                    opinion.absolute_url ||
                    (opinion.id
                        ? `https://www.courtlistener.com/opinion/${opinion.id}/`
                        : undefined);
                return {
                    id: opinion.id,
                    case_name: opinion.caseName || opinion.case_name,
                    case_name_full: opinion.caseNameFull || opinion.case_name_full,
                    date_filed: opinion.dateFiled || opinion.date_filed,
                    date_modified: opinion.dateModified || opinion.date_modified,
                    court: opinion.court || opinion.court_name,
                    court_id: opinion.courtId || opinion.court_id,
                    jurisdiction: opinion.jurisdiction,
                    citation: opinion.citation,
                    citation_count: opinion.citationCount || opinion.citation_count,
                    precedential_status: opinion.precedentialStatus || opinion.precedential_status,
                    url: absoluteUrl,
                    absolute_url: absoluteUrl,
                    download_url: opinion.downloadUrl || opinion.download_url,
                    plain_text: opinion.plainText || opinion.plain_text,
                    html: opinion.html,
                    html_lawbox: opinion.htmlLawbox || opinion.html_lawbox,
                    html_columbia: opinion.htmlColumbia || opinion.html_columbia,
                    html_anon_2020: opinion.htmlAnon2020 || opinion.html_anon_2020,
                    judges: opinion.judges,
                    docket: opinion.docket,
                    docket_number: opinion.docketNumber || opinion.docket_number,
                    slug: opinion.slug,
                };
            }) || []);
        }
        catch (error) {
            if (error.response?.status === 403) {
                console.error("CourtListener API: API key required. Get one at https://www.courtlistener.com/api/");
            }
            else {
                console.error("CourtListener API error:", error.message || error);
            }
            return [];
        }
    }
    async getOpinion(opinionId) {
        try {
            const headers = {};
            if (this.apiKey) {
                headers["Authorization"] = `Token ${this.apiKey}`;
            }
            const response = await axios.get(`${API_ENDPOINTS.COURT_LISTENER}/search/${opinionId}/`, { headers });
            const opinion = response.data;
            return {
                id: opinion.id,
                case_name: opinion.caseName,
                case_name_full: opinion.caseNameFull,
                date_filed: opinion.dateFiled,
                date_modified: opinion.dateModified,
                court: opinion.court,
                court_id: opinion.courtId,
                jurisdiction: opinion.jurisdiction,
                citation: opinion.citation,
                citation_count: opinion.citationCount,
                precedential_status: opinion.precedentialStatus,
                url: opinion.absoluteUrl,
                absolute_url: opinion.absoluteUrl,
                download_url: opinion.downloadUrl,
                plain_text: opinion.plainText,
                html: opinion.html,
                html_lawbox: opinion.htmlLawbox,
                html_columbia: opinion.htmlColumbia,
                html_anon_2020: opinion.htmlAnon2020,
                judges: opinion.judges,
                docket: opinion.docket,
                docket_number: opinion.docketNumber,
                slug: opinion.slug,
            };
        }
        catch (error) {
            console.error("CourtListener API error:", error);
            return null;
        }
    }
}
// Regulations.gov API Functions
export class RegulationsGovAPI {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.REGULATIONS_GOV_API_KEY || "";
    }
    async searchComments(query, limit = 20) {
        try {
            const params = new URLSearchParams({
                q: query,
                "page[size]": limit.toString(),
                sort: "-postedDate",
                ...(this.apiKey && { api_key: this.apiKey }),
            });
            const response = await axios.get(`${API_ENDPOINTS.REGULATIONS_GOV}/comments?${params}`);
            return (response.data.data?.map((comment) => ({
                id: comment.id,
                comment: comment.attributes.comment,
                posted_date: comment.attributes.postedDate,
                agency_id: comment.attributes.agencyId,
                document_id: comment.attributes.documentId,
                submitter_name: comment.attributes.submitterName,
                organization: comment.attributes.organization,
            })) || []);
        }
        catch (error) {
            console.error("Regulations.gov API error:", error);
            return [];
        }
    }
}
// Main US Legal API Class
export class USLegalAPI {
    congress;
    federalRegister;
    usCode;
    regulations;
    courtListener;
    constructor(apiKeys) {
        this.congress = new CongressAPI(apiKeys?.congress);
        this.federalRegister = new FederalRegisterAPI();
        this.usCode = new USCodeAPI();
        this.regulations = new RegulationsGovAPI(apiKeys?.regulationsGov);
        this.courtListener = new CourtListenerAPI(apiKeys?.courtListener);
    }
    // Comprehensive search across all sources
    async searchAll(query, limit = 20) {
        const [bills, regulations, codeSections, comments] = await Promise.all([
            this.congress.searchBills(query, undefined, Math.ceil(limit / 4)),
            this.federalRegister.searchDocuments(query, Math.ceil(limit / 4)),
            this.usCode.searchCode(query, undefined, Math.ceil(limit / 4)),
            this.regulations.searchComments(query, Math.ceil(limit / 4)),
        ]);
        return {
            bills,
            regulations,
            codeSections,
            comments,
        };
    }
}
export default USLegalAPI;
//# sourceMappingURL=us-legal-apis.js.map