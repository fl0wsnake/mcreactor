import { JsonController, Post, Body } from 'routing-controllers';
import { UserAttribute, UserModel } from '../models/User';
import User from '../models/User';
import { generateToken } from '../config/jwt';



@JsonController()
export class AuthController {
    @Post('/login')
    async login( @Body() user: UserAttribute) : Promise<any> 
    {
        const found = await User.findOne({
            where: {
                email: user.email
            }
        })
        if (found && found.password == user.password)
            return generateToken(found.dataValues)
        else
            return {success: false, message: 'Incorrect password or username'}

    }
}