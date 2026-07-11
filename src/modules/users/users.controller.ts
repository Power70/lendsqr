import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { UsersService } from './users.service';
import type { CreateUserInput } from './users.validators';

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  signUp = asyncHandler(async (req, res) => {
    const result = await this.usersService.signUp(req.body as CreateUserInput);
    res.status(201).json(success(result));
  });
}
