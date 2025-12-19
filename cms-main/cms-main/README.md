]🚀 Getting started with Strapi
Strapi comes with a full featured Command Line Interface (CLI) which lets you scaffold and manage your project in seconds.

develop
Start your Strapi application with autoReload enabled. Learn more

npx strapi develop
start
Start your Strapi application with autoReload disabled. Learn more

npx strapi start
build
Build your admin panel. Learn more

npx strapi build
⚙️ Deployment
Strapi gives you many possible deployment options for your project including Strapi Cloud. Browse the deployment section of the documentation to find the best solution for your use case.

Create a PR and merge into main and it will rebuild the cloud

or

npx strapi deploy
API
TOKEN
Local (you will probably create your own)

d15828d4bf9052364598ac45bf483ab02f30b944434e5cba608f5c79bf3a808a1c1565b3291b4b6245867423616cf9582bda3739afc2f246ff99a86bff810b3f9f649e5b777b4d3aaa67e37034e542cbdc73dba5cd34e075c27b2b19fd4d51c775453e7765f826a4f1bc0074ba6c46c8473759e46e4246e19d2c3a15c3165387

production

https://majestic-cuddle-3c51b2f88e.strapiapp.com/admin

LOCATIONS
local NEW TOKEN 28c456f4ce740e8ce94f695dce407db7667b363ea4e6966dbf47eda78dc05042cbb15a7ac500c4a7fdd3608f1229d257f7d8c314fa2e707ce73f6b37d004db09b1cfe7e9a3fcfee41d06093ce5cc169931c3718aee12b51f3b1a5e90415dd9434dc7a0747840bb01e1b179af889df1df71042dd96637ef45e13654b79142f2e7

curl -X GET http://localhost:1337/api/properties?populate=\*
-H "Authorization: Bearer 7b4923fb6ceed948c08e0795fb31cf74bd0b31cdd880775c5b1c8d8ce3c50acfdc7d1fba399d53426bc44581bf67c4e847e18417d91f3a90e85d8082771949d73f095a207d4a5874afa6031835a078b731277a8e1051ab8ae65dbd7f7dac76fdbaa8949a750cbe597660441587fc7cef89f47fd8d90f4e61804e64040c25a47c"

curl -X GET http://localhost:1337/api/locations?filters[City][$eqi]=london
-H "Authorization: Bearer d15828d4bf9052364598ac45bf483ab02f30b944434e5cba608f5c79bf3a808a1c1565b3291b4b6245867423616cf9582bda3739afc2f246ff99a86bff810b3f9f649e5b777b4d3aaa67e37034e542cbdc73dba5cd34e075c27b2b19fd4d51c775453e7765f826a4f1bc0074ba6c46c8473759e46e4246e19d2c3a15c3165387"

If you get no match then your terminal sucks and you have to format the brackets

URL-Encoded Version Explained: [ becomes %5B

] becomes %5D

$ becomes %24

curl -X GET 'http://localhost:1337/api/locations?filters[City][%24eqi]=london'
-H 'Authorization: Bearer d15828d4bf9052364598ac45bf483ab02f30b944434e5cba608f5c79bf3a808a1c1565b3291b4b6245867423616cf9582bda3739afc2f246ff99a86bff810b3f9f649e5b777b4d3aaa67e37034e542cbdc73dba5cd34e075c27b2b19fd4d51c775453e7765f826a4f1bc0074ba6c46c8473759e46e4246e19d2c3a15c3165387'

production

curl -X GET https://majestic-cuddle-3c51b2f88e.strapiapp.com/api/locations/?populate=Images*
-H "Authorization: Bearer d3ebf900e7b11a63b8c9d4e407c1354a02837b611e2e54b8d603ece3aafc964acb528df06fb95223635e2fc5caa094daeede6aaf5f0ea1ba1d2e22819230b817e2f75dba206d1470b8ddff753fe84fe09aa2479b63e79fad8f27240be411e5c61d62831c344ffa6ab57c593cdfe4bc91fcacf01d35aed074dd9f533700385a17"

curl -X GET https://majestic-cuddle-3c51b2f88e.strapiapp.com/api/locations/
-H "Authorization: Bearer d3ebf900e7b11a63b8c9d4e407c1354a02837b611e2e54b8d603ece3aafc964acb528df06fb95223635e2fc5caa094daeede6aaf5f0ea1ba1d2e22819230b817e2f75dba206d1470b8ddff753fe84fe09aa2479b63e79fad8f27240be411e5c61d62831c344ffa6ab57c593cdfe4bc91fcacf01d35aed074dd9f533700385a17"

curl -X GET 'https://majestic-cuddle-3c51b2f88e.strapiapp.comapi/locations?filters[City][%24eqi]=london'
-H 'Authorization: Bearer d3ebf900e7b11a63b8c9d4e407c1354a02837b611e2e54b8d603ece3aafc964acb528df06fb95223635e2fc5caa094daeede6aaf5f0ea1ba1d2e22819230b817e2f75dba206d1470b8ddff753fe84fe09aa2479b63e79fad8f27240be411e5c61d62831c344ffa6ab57c593cdfe4bc91fcacf01d35aed074dd9f533700385a17'

TRANSFER TOKEN

To push the content from local

npx strapi transfer

remote url

https://majestic-cuddle-3c51b2f88e.strapiapp.com/admin/
https://cms.atlasora.com/admin

transfer token (push local to production)

d2a8e5f83ca9e4ca64dd96d847e21d4c6282bebb313ed1a6cfd7b4d563e40a0e4ab217248e45897144a0dc09a6fd8b1914e560b60313764d5a70d95dcf30a286575672c10614ace8b316ff26d71d4e150f5fc7695afedb2fca7ee7c0d24513e05ebac7288ffbe16ea4be9bdc84a4be75fe934dbf4281cd6b757a0e6e43f4c3c6

transfer token (pull production to local)

97a17b8ed57d25980b8ac8af2fef83b544f9a829870cac6067c4a32747f9b67f24fba9d46f04539f1cafa40a1b64c8723b21932f9033a170135b30ea5ea00020207fbf9483e482d0f2b2220199608e186caabc2427cdaf40a330823281510c0200f634148885e94bd04137a4418f5199c39985b502dd538df390066493a99808

📚 Learn more
Resource center - Strapi resource center.
Strapi documentation - Official Strapi documentation.
Strapi tutorials - List of tutorials made by the core team and the community.
Strapi blog - Official Strapi blog containing articles made by the Strapi team and the community.
Changelog - Find out about the Strapi product updates, new features and general improvements.
Feel free to check out the Strapi GitHub repository. Your feedback and contributions are welcome!

✨ Community
Discord - Come chat with the Strapi community including the core team.
Forum - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
Awesome Strapi - A curated list of awesome things related to Strapi.
🤫 Psst! Strapi is hiring.
