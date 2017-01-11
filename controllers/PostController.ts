import PostRate from '../models/PostRate';
import db from '../config/db';
import authMiddleware from '../middlewares/AuthMiddleware';
import {Commentary, Tag, User, Post} from '../models/models';
import {Context} from '~koa/lib/context';
import * as Router from 'koa-router';
import getPosts from "../lib/post";
import adminMiddleware from "../middlewares/AdminMiddleware";
import notifyAboutNewBestPost from "../lib/notifier";

const PostController = new Router()

const multer = require('koa-multer')
const upload = multer({dest: './public/images'})

PostController
    
    .post('/post',
        upload.single('image'),
        authMiddleware(),
        async(ctx: Context) => {
            try
            {
                let userId = ctx.user.id
                let tags = ctx.req.body.tags
                              .split(',')
                              .filter(tag => tag != '')
                              .map(tag => {
                                  return {'name': tag.trim()}
                              })
                
                let image = ctx.req.file ? ctx.req.file.filename : null
                
                let post = await Post.create({
                    content: ctx.req.body.content,
                    image: image,
                    UserId: userId
                }) as any
                
                if (tags.length)
                {
                    await Tag.bulkCreate(tags, {
                        updateOnDuplicate: ['name']
                    })
                    
                    await post.setTags(await Tag.findAll({
                        where: {
                            name: {
                                in: ctx.req.body.tags.split(',').map(tag => tag.trim())
                            }
                        }
                    }))
                }
                ctx.body = {success: true, message: ''}
            }
            catch (e)
            {
                ctx.body = {success: false, message: `Something went wrong: ${e}`}
            }
        })
    
    .get('/post/:id',
        authMiddleware(true),
        async(ctx) => {
            const id = ctx.params.id
            ctx.body = await getPosts(ctx.user ? ctx.user.id : null, {
                id: id
            })
        })
    
    .get('/post',
        authMiddleware(true),
        async(ctx) => {
            ctx.body = await getPosts(ctx.user ? ctx.user.id : null, ctx.user ? {
                    id: {
                        $notIn: db.literal("(select `PostId` from `PostTag` where `TagId` in (select `TagId` from `Bans` where `UserId` = " + ctx.user.id + "))")
                    }
                } : null) //exclude banned posts when user is logged in
        })
    
    .get('/best',
        authMiddleware(true),
        async(ctx) => {
            ctx.body = await getPosts(ctx.user ? ctx.user.id : null, ctx.user ? {
                    id: {
                        $notIn: db.literal("(select `PostId` from `PostTag` where `TagId` in (select `TagId` from `Bans` where `UserId` = " + ctx.user.id + "))")
                    },
                    rating: {
                        $gte: 50
                    }
                } : {
                    rating: {
                        $gte: 50
                    }
                }) //exclude banned posts when user is logged in
        })
    
    .get('/good',
        authMiddleware(true),
        async(ctx) => {
            ctx.body = await getPosts(ctx.user ? ctx.user.id : null, ctx.user ? {
                    id: {
                        $notIn: db.literal("(select `PostId` from `PostTag` where `TagId` in (select `TagId` from `Bans` where `UserId` = " + ctx.user.id + "))")
                    },
                    rating: {
                        $gte: 20
                    }
                } : {
                    rating: {
                        $gte: 20
                    }
                }) //exclude banned posts when user is logged in
        })
    
    .get('/post/tag/:id',
        authMiddleware(true),
        async(ctx) => {
            let id = ctx.params.id
            ctx.body = await getPosts(ctx.user.id, {
                id: {
                    $in: db.literal("(select `PostId` from `PostTag` where `TagId` = " + id + ")")
                }
            })
        })
    
    .get('/post/user/subscribed',
        authMiddleware(),
        async(ctx) => {
            let id = ctx.user.id
            ctx.body = await getPosts(ctx.user.id, {
                id: {
                    $in: db.literal("(select `PostId` from `PostTag` where `TagId` in (select `TagId` from `Subscriptions` where `UserId` = " + id + "))")
                }
            })
        })
    
    //ajax rate route
    .get('/post/:id/rate/:rate',
        authMiddleware(),
        async(ctx) => {
            let id = ctx.params.id
            let rate = ctx.params.rate
            let previousRate = await PostRate.findOne({
                where: {
                    PostId: id,
                    UserId: ctx.user.id
                },
                include: [Post, User]
            })
            if (previousRate)
            {
                previousRate.User.rating -= previousRate.rate
                previousRate.Post.rating -= previousRate.rate
                if (rate == 'neutral')
                {
                    await previousRate.destroy()
                }
                else
                {
                    previousRate.rate = (rate == 'like' ? 1 : -1)
                    previousRate.User.rating += previousRate.rate
                    previousRate.Post.rating += previousRate.rate
                    await previousRate.save()
                }
                await previousRate.User.save()
                await previousRate.Post.save()
                ctx.body = {success: true, rating: previousRate.Post.rating}
                if(previousRate.Post.rating >= 50)
                {
                    notifyAboutNewBestPost(id)
                }
            }
            else if (rate != 'neutral')
            {
                let newRate = await PostRate.create(<any>{
                    rate: (rate == 'like' ? 1 : -1),
                    UserId: ctx.user.id,
                    PostId: id
                })
                let post = await Post.findById(id, {
                    include: [User]
                })
                post.User.rating += newRate.rate
                post.rating += newRate.rate
                await newRate.save()
                await post.save()
                await post.User.save()
                ctx.body = {success: true, rating: post.rating}
                if(post.rating >= 50)
                {
                    notifyAboutNewBestPost(id)
                }
            }
            else
            {
                ctx.body = {success: true}
            }
        })
    
    
    .get('/user/:id/profile',
        authMiddleware(true),
        async(ctx) => {
            let userId = ctx.params.id
            ctx.body = await getPosts(ctx.user ? ctx.user.id : null, {
                UserId: userId
            })
        })
    
    .get('/post/:id/delete',
        authMiddleware(),
        async(ctx) => {
            let postId = ctx.params.id
            await Post.destroy({
                where: {
                    id: postId
                }
            })
            ctx.body = {success: true}
        })
    
    .post('/post/filter',
        authMiddleware(true),
        async(ctx) => {
            let filter = ctx.request.body
            let whereClause: any = {}
            if (filter.tagsArray && filter.tagsArray.length)
            {
                filter.tags = filter.tagsArray
                                    .filter(tag => tag != '')
                                    .map(tag => "'" + tag.trim() + "'")
                whereClause.id = {
                    $in: db.literal(" (select `Posts`.`id` from `Posts` " +
                        "where (select count(`TagId`) from `PostTag` inner join `Tags` on `Tags`.`id` = `PostTag`.`TagId` " +
                        "where `PostTag`.`PostId` = `Posts`.`id` and `Tags`.`name` in (" + filter.tags.join(',') + ") ) = " + filter.tags.length + " ) ")
                }
            }
            if (filter.content)
                whereClause.content = {
                    $like: `%${filter.content}%`
                }
            if (filter.dateFrom || filter.dateTo)
            {
                whereClause.createdAt = {}
                if (filter.dateFrom)
                    whereClause.createdAt.$gte = new Date(filter.dateFrom)
                if (filter.dateTo)
                {
                    let date = new Date(filter.dateTo)
                    date.setHours(23, 59, 59, 0)
                    whereClause.createdAt.$lte = date
                }
            }
            if (filter.ratingTo || filter.ratingFrom)
            {
                whereClause.rating = {}
                if (filter.ratingTo)
                    whereClause.rating.$lte = filter.ratingTo
                if (filter.ratingFrom)
                    whereClause.rating.$gte = filter.ratingFrom
            }
            console.log(whereClause)
            let posts = await getPosts(ctx.user ? ctx.user.id : null, whereClause)
            ctx.body = {success: true, posts}
        })
    
    .get('/stats',
        authMiddleware(),
        adminMiddleware,
        async(ctx) => {
            let postCountByDay = await Post.findAll({
                attributes: [db.fn('date', db.col('createdAt')), db.fn('count', 'id')],
                group: [db.fn('date', db.col('createdAt'))],
                raw: true
            })
            let commentCountByDay = await Commentary.findAll({
                attributes: [db.fn('date', db.col('createdAt')), db.fn('count', 'id')],
                group: [db.fn('date', db.col('createdAt'))],
                raw: true
            })
            
            let ratingCountByTag = await db.query("SELECT `Tag`.`name` as 'name', sum(`Posts`.`rating`) as 'rating'" +
                " FROM `Tags` AS `Tag` LEFT OUTER JOIN (`PostTag` AS `Posts.PostTag` INNER JOIN `Posts` AS `Posts` ON `Posts`.`id` = `Posts.PostTag`.`PostId`)" +
                " ON `Tag`.`id` = `Posts.PostTag`.`TagId` GROUP BY `Tag`.`id`;")
            
            let ratingAvgByTag = await db.query("SELECT `Tag`.`name` as 'name', avg(`Posts`.`rating`) as 'rating'" +
                " FROM `Tags` AS `Tag` LEFT OUTER JOIN (`PostTag` AS `Posts.PostTag` INNER JOIN `Posts` AS `Posts` ON `Posts`.`id` = `Posts.PostTag`.`PostId`)" +
                " ON `Tag`.`id` = `Posts.PostTag`.`TagId` GROUP BY `Tag`.`id`;")
            
            ctx.body = {postCountByDay, commentCountByDay, ratingCountByTag, ratingAvgByTag}
        })

export default PostController