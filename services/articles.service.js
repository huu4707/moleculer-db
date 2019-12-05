const Fakerator = require("fakerator");
const fakerator = Fakerator();
const DbService = require("moleculer-db");

module.exports = {
  name: "articles",

  mixins: [DbService],

  adapter: new DbService.MemoryAdapter(),

  settings: {
    // Available fields
    fields: ["_id", "title", "content", "author", "votes", "created"],

    // Populating
    populates: {
      author: {
        action: "users.get",
        params: {
          fields: ["firstName", "lastName"]
        }
      }
    },

    // Validation schema for insert & update
    entityValidator: {
      title: { type: "string", empty: false },
      content: { type: "string" },
      author: { type: "string", empty: false }
    }
  },

  hooks: {
    before: {
      create(ctx) {
        ctx.params.votes = 0;
        ctx.params.created = new Date();
        //insert db
      },
      update(ctx) {
        ctx.params.updated = new Date();
        //update db
      }
    }
  },

  actions: {
    // Define new actions
    vote: {
      params: {
        id: { type: "string" }
      },
      async handler(ctx) {
        const res = await this.adapter.updateById(ctx.params.id, {
          $inc: { votes: 1 }
        });
        return await this.transformDocuments(ctx, {}, res);
      }
    },

    unvote: {
      params: {
        id: { type: "string" }
      },
      async handler(ctx) {
        const res = await this.adapter.updateById(ctx.params.id, {
          $inc: { votes: -1 }
        });
        return await this.transformDocuments(ctx, {}, res);
      }
    }
  },

  methods: {
    async seedDB() {
      this.logger.info("Seed Articles database...");

      await this.waitForServices("users"); // chờ tạo user
      let authors = (await this.broker.call("users.list")).rows; //kt xem có bnhiu user

      if (!authors || authors.length === 0) {
        await this.Promise.delay(2000); // delay 2s
        authors = (await this.broker.call("users.list")).rows; // tiếp tục kt
      }

      const fakeArticles = fakerator.times(fakerator.entity.post, 10); // tạo bài viết
      fakeArticles.forEach(article => {
        article.author = fakerator.random.arrayElement(authors)._id; // ramdom author
        article.votes = fakerator.random.number(10); // ramdom votes
      });

      // Save to DB
      const savedArticles = await this.adapter.insertMany(fakeArticles);
    }
  },

  async started() {
    if ((await this.adapter.count()) === 0) {
      await this.seedDB();
    } else {
      this.logger.info(`DB contains ${await this.adapter.count()} articles.`);
    }
  },

  stopped() {}
};
