import cheerio from "cheerio";
import {
    extractMidPatchDates,
    midPatchDateEndMs,
    getPatchVersion,
    generateFinalOutput,
} from "./webScraper.js";

const EPOCH_18_1 = Date.parse("2026-08-25T18:00:00.000Z");

describe("extractMidPatchDates", () => {
    test("set 17+ markup: h3 date entries under the Mid-Patch Updates header", () => {
        const $ = cheerio.load(`
            <article>
                <header><h2 id="patch-midpatch-updates">Mid-Patch Updates</h2></header>
                <div class="content-border"><div>
                    <h3>AUGUST 28TH</h3><h4>NEW FEATURE</h4><h4>BUG FIXES</h4>
                </div></div>
                <div class="content-border"><div>
                    <h3>AUGUST 27TH</h3><h4>BUG FIXES</h4>
                </div></div>
                <header><h2 id="patch-systems">SYSTEMS</h2></header>
                <div class="content-border"><div><h4>MAY 9TH</h4></div></div>
            </article>
        `);
        expect(extractMidPatchDates($)).toEqual(["AUGUST 28TH", "AUGUST 27TH"]);
    });

    test("legacy markup: h4 date entries under the Mid-Patch Updates header", () => {
        const $ = cheerio.load(`
            <article>
                <header><h2>Mid-Patch Updates</h2></header>
                <div><h4>JULY 10TH, BALANCE CHANGES</h4><ul><li>x</li></ul></div>
                <div><h4>JUNE 29TH, BALANCE CHANGES</h4></div>
            </article>
        `);
        expect(extractMidPatchDates($)).toEqual([
            "JULY 10TH, BALANCE CHANGES",
            "JUNE 29TH, BALANCE CHANGES",
        ]);
    });

    test("standalone dated section headers", () => {
        const $ = cheerio.load(`
            <article>
                <header><h2 id="patch-august-13">AUGUST 13TH</h2></header>
                <div><h4>BUG FIXES</h4></div>
                <header><h2 id="patch-large-changes">LARGE CHANGES</h2></header>
            </article>
        `);
        expect(extractMidPatchDates($)).toEqual(["AUGUST 13TH"]);
    });

    test("versioned header with no dated entries is kept as the entry", () => {
        const $ = cheerio.load(`
            <article>
                <header><h2>15.1B PATCH UPDATES</h2></header>
                <div><h4>BUG FIXES</h4></div>
            </article>
        `);
        expect(extractMidPatchDates($)).toEqual(["15.1B PATCH UPDATES"]);
    });

    test("no mid-patch section yields no entries", () => {
        const $ = cheerio.load(`
            <article>
                <header><h2 id="patch-systems">SYSTEMS</h2></header>
                <div><h4>AUGMENTS</h4></div>
            </article>
        `);
        expect(extractMidPatchDates($)).toEqual([]);
    });
});

describe("midPatchDateEndMs", () => {
    test("resolves to the end of the entry's day in Pacific time", () => {
        expect(midPatchDateEndMs("AUGUST 28TH", EPOCH_18_1)).toBe(
            Date.UTC(2026, 7, 29, 8)
        );
    });

    test("an entry listing several dates resolves to its last date", () => {
        expect(
            midPatchDateEndMs("AUGUST 31ST AND SEPTEMBER 1ST", EPOCH_18_1)
        ).toBe(Date.UTC(2026, 8, 2, 8));
    });

    test("January mid-patch of a December patch lands in the next year", () => {
        const decemberEpoch = Date.parse("2025-12-20T18:00:00.000Z");
        expect(midPatchDateEndMs("JANUARY 3RD", decemberEpoch)).toBe(
            Date.UTC(2026, 0, 4, 8)
        );
    });

    test("returns null for entries without a date", () => {
        expect(midPatchDateEndMs("15.1B PATCH UPDATES", EPOCH_18_1)).toBeNull();
    });
});

describe("getPatchVersion", () => {
    const title = "Teamfight Tactics patch 18.1";

    test("no entries keeps the base version", () => {
        expect(getPatchVersion({ title, midPatchUpdateDates: [] })).toBe(
            "18.1"
        );
    });

    test("entry count maps to the patch letter", () => {
        expect(
            getPatchVersion({ title, midPatchUpdateDates: ["AUGUST 27TH"] })
        ).toBe("18.1b");
        expect(
            getPatchVersion({
                title,
                midPatchUpdateDates: ["AUGUST 28TH", "AUGUST 27TH"],
            })
        ).toBe("18.1c");
    });

    test("an explicit letter overrides the count", () => {
        expect(
            getPatchVersion({
                title: "Teamfight Tactics patch 15.1",
                midPatchUpdateDates: ["15.1B PATCH UPDATES"],
            })
        ).toBe("15.1b");
    });
});

describe("generateFinalOutput", () => {
    const article = {
        title: "Teamfight Tactics patch 18.1",
        url: "https://example.invalid/18-1",
    };
    const timestamp = "2026-08-25T18:00:00.000Z";

    test("without mid-patches the epochs match the article timestamp", () => {
        const output = generateFinalOutput(article, [], timestamp);
        expect(output.epoch).toBe(EPOCH_18_1);
        expect(output.midPatchEpoch).toBe(EPOCH_18_1);
        expect(output.patchVersion).toBe("18.1");
    });

    test("midPatchEpoch is the end of the newest entry's last day", () => {
        const output = generateFinalOutput(
            article,
            ["AUGUST 31ST AND SEPTEMBER 1ST", "AUGUST 28TH", "AUGUST 27TH"],
            timestamp
        );
        expect(output.midPatchEpoch).toBe(Date.UTC(2026, 8, 2, 8));
        expect(output.patchVersion).toBe("18.1d");
        expect(output.midPatchUpdateDates).toEqual([
            "AUGUST 31ST AND SEPTEMBER 1ST",
            "AUGUST 28TH",
            "AUGUST 27TH",
        ]);
    });
});
