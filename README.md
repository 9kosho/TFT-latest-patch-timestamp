runs multiple times a day using github actions and updates patch_version.json

`patch_version.json` is generated from scraping the updated patch notes

it should also update depending on if there are hotfix patches (e.g. 18.2b, 18.2c, 18.2c, etc.)

note that the code is a bit brittle as it's dependent on the patch note html staying more or less the same
