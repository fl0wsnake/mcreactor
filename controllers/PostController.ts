import {PostAttribute} from '../models/Post';
import PostRate from '../models/PostRate';
import CommentaryRate from '../models/CommentaryRate';
import db from '../config/db';
import authMiddleware from '../middlewares/AuthMiddleware';
import {Commentary, Tag, User, Post} from '../models/models';
import {Context} from '~koa/lib/context';
import * as Router from 'koa-router';

const PostController = new Router()

const multer = require('koa-multer')
const upload = multer({dest: './public/images'})

PostController
    
    .post('/post',
        upload.single('image'),
        authMiddleware,
        async(ctx: Context) =>
        {
            try
            {
                let userId = ctx.user.id
                let tags = ctx.req.body.tags
                              .split(',')
                              .map(tag =>
                              {
                                  return {'name': tag.trim()}
                              })
                
                await Tag.bulkCreate(tags, {
                    updateOnDuplicate: ['name']
                })
                
                let image = ctx.req.file ? ctx.req.file.filename : null
                
                let post = await Post.create({
                    content: ctx.req.body.content,
                    image: image,
                    UserId: userId
                }) as any
                
                await post.setTags(await Tag.findAll({
                    where: {
                        name: {
                            in: ctx.req.body.tags.split(',').map(tag => tag.trim())
                        }
                    }
                }))
                ctx.body = {success: true, message: ''}
            }
            catch (e)
            {
                ctx.body = {success: false, message: `Something went wrong: ${e}`}
            }
        })
    
    .get('/post/:id',
        async(ctx) =>
        {
            const id = ctx.params.id
            const post = Post.findById()
        })
    
    .get('/post',
        authMiddleware,
        async(ctx) =>
        {
            const posts = await Post.findAll({
                include: [
                    {
                        model: PostRate,
                        where: {
                            UserId: ctx.user.id
                        },
                        required: false
                    },
                    Tag,
                    User,
                    {
                        model: Commentary,
                        include: [User, {
                            model: CommentaryRate,
                            where: {
                                UserId: ctx.user.id
                            },
                            required: false
                        }]
                    }
                ],
                order: [
                    ['createdAt', 'DESC'],
                    [Commentary, 'createdAt']
                ]
            })
            ctx.body = posts.map(post => post.get())
        })
    
    .get('/post/tag/:id',
        authMiddleware,
        async(ctx) =>
        {
            let id = ctx.params.id
            ctx.body = await Post.findAll({
                where: {
                    id: {
                        $in: db.literal("(select `PostId` from `PostTag` where `TagId` = " + id + ")")
                    }
                },
                include: [
                    {
                        model: PostRate,
                        where: {
                            UserId: ctx.user.id
                        },
                        required: false
                    },
                    Tag,
                    User,
                    {
                        model: Commentary,
                        include: [User, {
                            model: CommentaryRate,
                            where: {
                                UserId: ctx.user.id
                            },
                            required: false
                        }]
                    }
                ],
                order: [
                    ['createdAt', 'DESC'],
                    [Commentary, 'createdAt']
                ]
            })
        })
    
    //ajax rate route
    .get('/post/:id/rate/:rate',
        authMiddleware,
        async(ctx) =>
        {
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
            }
            else
            {
                ctx.body = {success: true}
            }
        })

export default PostController
