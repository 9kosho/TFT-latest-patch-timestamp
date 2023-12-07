const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeArticleData(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const articles = [];

    $("li").each((index, element) => {
        const title = $(element).find("h2").text();
        const datetime = $(element).find("time").attr("datetime");
        const articleUrl = $(element).find("a").attr("href");

        articles.push({
            title: title,
            datetime: datetime,
            url: `https://www.leagueoflegends.com${articleUrl}`,
        });
    });

    return articles;
}

async function getDataFromUrl(url) {
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

async function checkForMidPatchUpdates(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const isMidPatchUpdatesPresent =
        $("h2:contains('Mid-Patch Updates')").length > 0;
    const isMidPatchUpdatePresent =
        $("h2:contains('Mid-Patch Update')").length > 0;

    return isMidPatchUpdatesPresent || isMidPatchUpdatePresent;
}

async function extractTimestamp(url) {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const timestamp = $("time").attr("datetime");

    return timestamp;
}

async function extractMidPatchUpdatesDates(url) {
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

async function generateFinalOutput(
    firstPatchData,
    isMidPatchUpdate,
    extractedDates,
    timestamp
) {
    let latestDate;

    if (isMidPatchUpdate) {
        // Convert date strings to Date objects
        const parsedDates = extractedDates.map((dateStr) => {
            const [month, day] = dateStr.split(" ");
            const currentYear = new Date().getFullYear();
            // Create a new date using the current year; assumes the environment is set to PST
            return new Date(
                `${month} ${day.replace(
                    /\D/g,
                    ""
                )}, ${currentYear} 12:00:00 GMT-0800`
            );
        });

        // Sort to get the latest date
        parsedDates.sort((a, b) => b - a);
        latestDate = parsedDates[0];

        // Adjust the time to be in UTC
        latestDate = new Date(
            latestDate.getTime() + 8 * 60 * 60 * 1000
        ).toISOString();
    }

    const utcTimestamp = isMidPatchUpdate ? latestDate : timestamp;

    return {
        title: firstPatchData.title,
        url: firstPatchData.url,
        timestamp: utcTimestamp,
        epoch: Date.parse(timestamp),
        midPatchEpoch: Date.parse(utcTimestamp),
        midPatchUpdateDates: isMidPatchUpdate ? extractedDates : [],
    };
}

module.exports = {
    checkForMidPatchUpdates,
    getDataFromUrl,
    scrapeArticleData,
    extractTimestamp,
    extractMidPatchUpdatesDates,
    generateFinalOutput,
};
