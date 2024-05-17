import axios from "axios";
import cheerio from "cheerio";

export async function scrapeArticleData(url) {
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
