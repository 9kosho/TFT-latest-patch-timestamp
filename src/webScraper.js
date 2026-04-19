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
export async function getDataFromUrl(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const title = $("h1").text().trim();
    const content = $("article").html();

    return {
        title: title,
        content: content,
        url: url,
    };
}

function findMidPatchHeaders($) {
    // First try legacy patterns
    let headers = $(
        "h2:contains('Mid-Patch Update'), h2:contains('Mid-Patch Updates')"
    );

    // Then try versioned pattern (e.g., "15.1B PATCH UPDATES" or "17.1B PATCH")
    if (headers.length === 0) {
        headers = $("h2").filter(function () {
            return /\d+\.\d+[A-Za-z]+\s+PATCH(\s+UPDATES?)?\b/i.test(
                $(this).text().replace(/\s+/g, ' ').trim()
            );
        });
    }
    return headers;
}

function findPatchDateHeaders($) {
    // Look for h2 elements with id in format "patch-{month}-{day}"
    // Example: <h2 id="patch-august-13">AUGUST 13TH</h2>
    const patchDateHeaders = $("h2[id^='patch-']").filter(function () {
        const id = $(this).attr('id');
        // Check if id matches pattern: patch-{month}-{day}
        const patchDatePattern = /^patch-[a-z]+-\d+$/i;
        return patchDatePattern.test(id);
    });
    
    return patchDateHeaders;
}

export async function checkForMidPatchUpdates(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Use helper function to find mid-patch headers
    const midPatchHeaders = findMidPatchHeaders($);
    
    // Also check for patch date headers (new detection method)
    const patchDateHeaders = findPatchDateHeaders($);

    // Return true if either detection method finds mid-patch indicators
    return midPatchHeaders.length > 0 || patchDateHeaders.length > 0;
}

export async function extractTimestamp(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const timestamp = $("time").attr("datetime");

    return timestamp;
}

export async function extractMidPatchUpdatesDates(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const updates = [];

    // Use helper function to find mid-patch headers
    const midPatchHeader = findMidPatchHeaders($);

    if (midPatchHeader.length > 0) {
        let sibling = midPatchHeader.parent("header").next();
        // Match an h4 that begins with a month name followed by a day number,
        // e.g. "MAY 4TH" or "JULY 10TH, BALANCE CHANGES". The trailing space+digit
        // requirement avoids false positives like "AUGMENTS" matching "AUG".
        const dateRegex = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d/i;

        while (
            sibling.length > 0 &&
            sibling.prop("tagName").toLowerCase() !== "header"
        ) {
            let foundDate = false;

            sibling.find("h4").each((index, element) => {
                if (!foundDate) {
                    const updateDate = $(element).text().trim();
                    if (dateRegex.test(updateDate)) {
                        updates.push(updateDate);
                        foundDate = true; // Mark that the date was found and stop adding subsequent dates within the sibling div
                    }
                }
            });

            sibling = sibling.next();
        }

        // If the header itself carries the patch letter (e.g. "17.1B PATCH")
        // and no h4 date entries were captured, record the header text so the
        // mid-patch is still reflected in the output and patch version suffix.
        if (updates.length === 0) {
            midPatchHeader.each((index, element) => {
                const headerText = $(element).text().replace(/\s+/g, ' ').trim();
                if (/\d+\.\d+[A-Za-z]+\s+PATCH\b/i.test(headerText)) {
                    updates.push(headerText);
                }
            });
        }
    }

    // Also check for patch date headers (new pattern)
    const patchDateHeaders = findPatchDateHeaders($);
    
    if (patchDateHeaders.length > 0) {
        patchDateHeaders.each((index, element) => {
            const dateText = $(element).text().trim();
            // Only add if not already in updates array
            if (!updates.includes(dateText)) {
                updates.push(dateText);
            }
        });
    }

    return updates;
}

export async function getPatchVersion({ title, midPatchUpdateDates }) {
    // Extract the numerical portion from the title using a regular expression
    const patchNumber = title.match(/\d+\.\d+/)[0];

    // If any entry carries an explicit letter (e.g. "17.1B PATCH"),
    // use it directly rather than counting entries.
    let explicitLetter = "";
    for (const entry of midPatchUpdateDates) {
        const m = entry.match(/\d+\.\d+([A-Za-z])/);
        if (m && m[1].toLowerCase() > explicitLetter) {
            explicitLetter = m[1].toLowerCase();
        }
    }
    if (explicitLetter) {
        return `${patchNumber}${explicitLetter}`;
    }

    // Check the number of elements in midPatchUpdateDates
    const midPatchCount = midPatchUpdateDates.length;

    if (midPatchCount === 0) {
        // If there are no elements, return the patch number as is
        return patchNumber;
    } else {
        // If there are elements, append an incrementing letter
        const letter = String.fromCharCode(97 + midPatchCount); // 'a' is ASCII 97
        return `${patchNumber}${letter}`;
    }
}

export async function generateFinalOutput(
    firstPatchData,
    isMidPatchUpdate,
    extractedDates,
    timestamp,
    override = false
) {
    const currentEpoch = new Date().toISOString();
    const utcTimestamp = isMidPatchUpdate ? currentEpoch : timestamp;
    const patchVersion = await getPatchVersion({
        title: firstPatchData.title,
        midPatchUpdateDates: extractedDates,
    });

    // If override is true, use current time for both epoch values
    const epochValue = override ? Date.now() : Date.parse(timestamp);
    const midPatchEpochValue = override ? Date.now() : Date.parse(utcTimestamp);

    return {
        title: firstPatchData.title,
        url: firstPatchData.url,
        timestamp: override ? currentEpoch : utcTimestamp,
        epoch: epochValue,
        midPatchEpoch: midPatchEpochValue,
        midPatchUpdateDates: isMidPatchUpdate ? extractedDates : [],
        patchVersion,
    };
}
