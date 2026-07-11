import { success } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/utils/async-handler';
import type { AuthService } from './auth.service';
import type { LoginInput } from './auth.validators';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    const result = await this.authService.login(email, password);
    res.json(success(result));
  });
}
