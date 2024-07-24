import axios from "axios";
import cheerio from "cheerio";
import puppeteer from "puppeteer";
export async function scrapeArticleData(urls) {
    console.log("Starting scrapeArticleData function");
    const browser = await puppeteer.launch({
        headless: true,
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
            await page.waitForSelector('div[class="grid-content"]', {
                timeout: 10000,
            });
            console.log("Article grid found");

            const articleCount = await page.evaluate(() => {
                const grid = document.querySelector(
                    'div[class="grid-content"]'
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
            const grid = document.querySelector('div[class="grid-content"]');
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

    console.log(
        "Scraping completed. The browser will remain open for inspection."
    );
    console.log("Please close the browser manually when you're done.");

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

export async function checkForMidPatchUpdates(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const isMidPatchUpdatesPresent =
        $("h2:contains('Mid-Patch Updates')").length > 0;
    const isMidPatchUpdatePresent =
        $("h2:contains('Mid-Patch Update')").length > 0;

    return isMidPatchUpdatesPresent || isMidPatchUpdatePresent;
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

    const midPatchHeader = $(
        "h2:contains('Mid-Patch Update'), h2:contains('Mid-Patch Updates')"
    );

    if (midPatchHeader.length > 0) {
        let sibling = midPatchHeader.parent("header").next();
        const monthNames = [
            "JAN",
            "FEB",
            "MAR",
            "APR",
            "MAY",
            "JUN",
            "JUL",
            "AUG",
            "SEP",
            "OCT",
            "NOV",
            "DEC",
        ];

        while (
            sibling.length > 0 &&
            sibling.prop("tagName").toLowerCase() !== "header"
        ) {
            let foundDate = false;

            sibling.find("h4").each((index, element) => {
                if (!foundDate) {
                    const updateDate = $(element).text();
                    const isDate = monthNames.some((month) =>
                        updateDate.startsWith(month)
                    );

                    if (isDate) {
                        updates.push(updateDate);
                        foundDate = true; // Mark that the date was found and stop adding subsequent dates within the sibling div
                    }
                }
            });

            sibling = sibling.next();
        }
    }

    return updates;
}

export async function getPatchVersion({ title, midPatchUpdateDates }) {
    // Extract the numerical portion from the title using a regular expression
    const patchNumber = title.match(/\d+\.\d+/)[0];

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
    timestamp
) {
    const currentEpoch = new Date().toISOString();
    const utcTimestamp = isMidPatchUpdate ? currentEpoch : timestamp;
    const patchVersion = await getPatchVersion({
        title: firstPatchData.title,
        midPatchUpdateDates: extractedDates,
    });

    return {
        title: firstPatchData.title,
        url: firstPatchData.url,
        timestamp: utcTimestamp,
        epoch: Date.parse(timestamp),
        midPatchEpoch: Date.parse(utcTimestamp),
        midPatchUpdateDates: isMidPatchUpdate ? extractedDates : [],
        patchVersion,
    };
}
