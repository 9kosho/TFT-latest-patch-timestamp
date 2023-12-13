import {
    checkForMidPatchUpdates,
    scrapeArticleData,
    extractMidPatchUpdatesDates,
    extractTimestamp,
    generateFinalOutput,
    getDataFromUrl,
} from "./webScraper.js";

describe("ArticleList Scraper", () => {
    test("scrapes article data from the URL", async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/tags/teamfight-tactics-patch-notes/";
        const result = await scrapeArticleData(url);

        expect(result).toBeDefined();

        const article = result[0];

        expect(article).toHaveProperty("title");
        expect(article).toHaveProperty("datetime");
        expect(article).toHaveProperty("url");
    });

    test("expects a non-empty title for the scraped article", async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/tags/teamfight-tactics-patch-notes/";
        const result = await scrapeArticleData(url);

        const article = result[0];

        expect(article.title).toBeDefined();
        expect(article.title).not.toBe("");
    });
});

describe("Article Scraper", () => {
    test("checks if <h2> field with 'Mid-Patch Updates' is present", async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-14-notes/";
        const result = await checkForMidPatchUpdates(url);
        expect(result).toBeDefined();
    });
});

describe("Article Timestamp Scraper", () => {
    test("extracts timestamp from the article", async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-14-notes/";
        const result = await extractTimestamp(url);

        expect(result).toBeDefined();
        expect(result).not.toBe("");
    });
});

describe("Article Content Scraper", () => {
    test("extracts <h4> text after 'Mid-Patch Updates'", async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-14-notes/";
        const result = await extractMidPatchUpdatesDates(url);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).not.toBe("");
    });

    test('extracts ["MAY 4TH"] from 13.9', async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-9-notes/";
        const result = await extractMidPatchUpdatesDates(url);

        expect(result).toHaveLength(1);
        expect(result).toEqual(["MAY 4TH"]);
    });

    test('extracts ["JULY 10TH, BALANCE CHANGES", "JUNE 29TH, BALANCE CHANGES"] from 13.13', async () => {
        const url =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-13-notes/";
        const result = await extractMidPatchUpdatesDates(url);

        expect(result).toHaveLength(2);
        expect(result).toEqual([
            "JULY 10TH, BALANCE CHANGES",
            "JUNE 29TH, BALANCE CHANGES",
        ]);
    });
});

describe("Final Output Generator", () => {
    test("validate check for finalOutput.epoch vs finalOutput.midPatchEpoch", async () => {
        const patchNotesUrl =
            "https://www.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-14-notes/";

        const isMidPatchUpdate = await checkForMidPatchUpdates(patchNotesUrl);
        const data = await getDataFromUrl(patchNotesUrl);

        let updatesDates = [];
        if (isMidPatchUpdate) {
            updatesDates = await extractMidPatchUpdatesDates(patchNotesUrl);
        } else {
            console.log("No Mid-Patch Updates found.");
        }

        const timestamp = await extractTimestamp(patchNotesUrl);

        const finalOutput = await generateFinalOutput(
            data,
            isMidPatchUpdate,
            updatesDates,
            timestamp
        );

        // check that if finalOutput.epoch and finalOutput.midPatchEpoch are not equal,
        // then finalOutput.midPatchEpoch should be a greater value.
        if (finalOutput.epoch !== finalOutput.midPatchEpoch) {
            expect(finalOutput.midPatchEpoch).toBeGreaterThan(
                finalOutput.epoch
            );
        }

        expect(finalOutput).toBeDefined();
    });
});
