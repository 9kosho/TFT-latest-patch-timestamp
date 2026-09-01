import axios from "axios";
import cheerio from "cheerio";
import puppeteer from "puppeteer";
export async function scrapeArticleData(urls) {
    console.log("Starting scrapeArticleData function");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
    });
    console.log("Browser launched in visible mode");

    const page = await browser.newPage();
    console.log("New page created");

    await page.setExtraHTTPHeaders({
        Connection: "keep-alive",
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });
    await page.setViewport({ width: 1920, height: 1080 });

    let allArticles = [];

    for (const url of urls) {
        console.log(`Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle0" });
        console.log("Page loaded, waiting for article grid");

        try {
            await page.waitForSelector(
                'section[data-testid="article-card-grid"]',
                {
                    timeout: 10000,
                }
            );
            console.log("Article grid found");

            const articleCount = await page.evaluate(() => {
                const grid = document.querySelector(
                    'section[data-testid="article-card-grid"]'
                );
                return grid.querySelectorAll('div > a[role="button"]').length;
            });
            console.log(`Number of articles found: ${articleCount}`);

            if (articleCount < 12) {
                console.warn(
                    `Expected 12 articles, but found ${articleCount}. Proceeding with scraping.`
                );
            }
        } catch (error) {
            console.error(`Error processing page ${url}: ${error.message}`);
            continue;
        }

        const articles = await page.evaluate((baseUrl) => {
            console.log("Starting page evaluation");
            const grid = document.querySelector(
                'section[data-testid="article-card-grid"]'
            );
            const elements = grid.querySelectorAll('div > a[role="button"]');
            console.log(`Found ${elements.length} article elements`);

            return Array.from(elements).map((element, index) => {
                console.log(`Processing article element ${index + 1}`);

                const titleElement = element.querySelector(
                    '[data-testid="card-title"]'
                );
                const title = titleElement
                    ? titleElement.textContent.trim()
                    : "";
                console.log(`Title: "${title}"`);

                const datetimeElement = element.querySelector("time");
                const datetime = datetimeElement
                    ? datetimeElement.getAttribute("datetime")
                    : "";
                console.log(`Datetime: ${datetime}`);

                const relativeUrl = element.getAttribute("href") || "";
                const fullUrl = new URL(relativeUrl, baseUrl).href;
                console.log(`URL: ${fullUrl}`);

                return {
                    title: title,
                    datetime: datetime,
                    url: fullUrl,
                };
            });
        }, url); // Pass the current URL as baseUrl to the evaluate function

        console.log(`Scraped ${articles.length} articles from ${url}`);
        console.log(
            "Articles scraped from this URL:",
            JSON.stringify(articles, null, 2)
        );
        allArticles = allArticles.concat(articles);
    }

    console.log("Scraping completed.");

    console.log(`Total articles scraped: ${allArticles.length}`);
    console.log("All scraped articles:", JSON.stringify(allArticles, null, 2));

    const filteredArticles = allArticles.filter(
        (article) =>
            article.title.toLowerCase().includes("teamfight tactics") &&
            article.title.toLowerCase().includes("patch")
    );
    console.log(
        `Articles containing "Teamfight Tactics" and "patch": ${filteredArticles.length}`
    );
    console.log(
        "Filtered articles:",
        JSON.stringify(filteredArticles, null, 2)
    );

    filteredArticles.sort(
        (a, b) => new Date(b.datetime) - new Date(a.datetime)
    );
    console.log("Articles sorted by date");
    console.log(
        "Sorted and filtered articles:",
        JSON.stringify(filteredArticles, null, 2)
    );

    await browser.close();
    console.log("Browser closed");

    console.log("scrapeArticleData function completed");
    return filteredArticles;
}

const MONTH_INDEX = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
};

// Matches one date, e.g. "MAY 4TH" or "AUGUST 28TH". Requiring a digit
// after the month name avoids false positives like "AUGMENTS" matching "AUG".
const DATE_PATTERN =
    /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})/;

// A dated mid-patch entry heading starts with a date, e.g. "AUGUST 28TH"
// or "JULY 10TH, BALANCE CHANGES".
const DATE_ENTRY_REGEX = new RegExp(`^${DATE_PATTERN.source}`, "i");

const ALL_DATES_REGEX = new RegExp(DATE_PATTERN.source, "gi");

// Matches a section header that carries the patch letter itself,
// e.g. "17.1B PATCH" or "15.1B PATCH UPDATES".
const VERSIONED_HEADER_REGEX = /\d+\.\d+([A-Za-z])\s+PATCH(\s+UPDATES?)?\b/i;

function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
}

function findMidPatchHeaders($) {
    return $("h2").filter(function () {
        const text = normalizeText($(this).text());
        return (
            /mid-?patch update/i.test(text) || VERSIONED_HEADER_REGEX.test(text)
        );
    });
}

export function extractMidPatchDates($) {
    const entries = [];
    const seen = new Set();
    const collect = (text) => {
        const normalized = normalizeText(text);
        const key = normalized.toUpperCase();
        if (DATE_ENTRY_REGEX.test(normalized) && !seen.has(key)) {
            seen.add(key);
            entries.push(normalized);
        }
    };

    const sectionHeaders = findMidPatchHeaders($);

    // Dated entry headings within the section, scanning sibling content
    // blocks until the next section header. Riot has used both h4 and,
    // since set 17, h3 for these.
    sectionHeaders.each((index, element) => {
        let sibling = $(element).closest("header").next();
        while (sibling.length > 0 && !sibling.is("header")) {
            sibling.find("h3, h4").each((i, heading) => {
                collect($(heading).text());
            });
            sibling = sibling.next();
        }
    });

    // Alternate format where each mid-patch is its own dated article
    // section, e.g. <h2 id="patch-august-13">AUGUST 13TH</h2>.
    $("h2[id^='patch-']").each((index, element) => {
        collect($(element).text());
    });

    // A versioned section header with no dated entries still marks a
    // mid-patch; keep its text so the letter reaches getPatchVersion.
    if (entries.length === 0) {
        sectionHeaders.each((index, element) => {
            const text = normalizeText($(element).text());
            if (VERSIONED_HEADER_REGEX.test(text)) {
                entries.push(text);
            }
        });
    }

    return entries;
}

// Resolves a dated entry to the end of its day in Pacific time (08:00 UTC
// the next day, covering PST), an upper bound on when the update deployed.
// An entry listing several dates, e.g. "AUGUST 31ST AND SEPTEMBER 1ST",
// resolves to its last date. The year is whichever candidate lands closest
// to the patch epoch, which handles December patches with January
// mid-patches.
export function midPatchDateEndMs(entry, patchEpochMs) {
    const dates = [...normalizeText(entry).matchAll(ALL_DATES_REGEX)];
    if (dates.length === 0) {
        return null;
    }
    const [, monthName, dayText] = dates[dates.length - 1];
    const month = MONTH_INDEX[monthName.slice(0, 3).toUpperCase()];
    const day = Number(dayText);
    const referenceYear = new Date(patchEpochMs).getUTCFullYear();
    return [referenceYear - 1, referenceYear, referenceYear + 1]
        .map((year) => Date.UTC(year, month, day + 1, 8))
        .reduce((best, ms) =>
            Math.abs(ms - patchEpochMs) < Math.abs(best - patchEpochMs)
                ? ms
                : best
        );
}

export async function analyzePatchArticle(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    return {
        timestamp: $("time").attr("datetime"),
        midPatchDates: extractMidPatchDates($),
    };
}

export function getPatchVersion({ title, midPatchUpdateDates }) {
    const patchNumber = title.match(/\d+\.\d+/)[0];

    // If any entry carries an explicit letter (e.g. "17.1B PATCH"),
    // use it directly rather than counting entries.
    let explicitLetter = "";
    for (const entry of midPatchUpdateDates) {
        const match = entry.match(/\d+\.\d+([A-Za-z])/);
        if (match && match[1].toLowerCase() > explicitLetter) {
            explicitLetter = match[1].toLowerCase();
        }
    }
    if (explicitLetter) {
        return `${patchNumber}${explicitLetter}`;
    }

    if (midPatchUpdateDates.length === 0) {
        return patchNumber;
    }
    // One mid-patch entry means the b-patch, two the c-patch, and so on.
    const letter = String.fromCharCode(98 + midPatchUpdateDates.length - 1);
    return `${patchNumber}${letter}`;
}

export function generateFinalOutput(
    firstPatchData,
    midPatchDates,
    timestamp,
    override = false
) {
    const patchVersion = getPatchVersion({
        title: firstPatchData.title,
        midPatchUpdateDates: midPatchDates,
    });
    const epochValue = override ? Date.now() : Date.parse(timestamp);

    // Cut at the end of the newest mid-patch's last published day, the
    // canonical bound on when it deployed. Falls back to scrape time when
    // no entry parses to a date.
    let midPatchEpochValue = epochValue;
    if (override) {
        midPatchEpochValue = Date.now();
    } else if (midPatchDates.length > 0) {
        const dateEnds = midPatchDates
            .map((entry) => midPatchDateEndMs(entry, epochValue))
            .filter((ms) => ms !== null);
        midPatchEpochValue =
            dateEnds.length > 0 ? Math.max(...dateEnds) : Date.now();
    }

    return {
        title: firstPatchData.title,
        url: firstPatchData.url,
        timestamp: new Date(midPatchEpochValue).toISOString(),
        epoch: epochValue,
        midPatchEpoch: midPatchEpochValue,
        midPatchUpdateDates: midPatchDates,
        patchVersion,
    };
}
