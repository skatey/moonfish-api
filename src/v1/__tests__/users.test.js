/* eslint no-underscore-dangle: ["error", { "allow": ["_id"] }] */

const User = require('../../models/user');

const app = require('../../../src/app');
const {
  setupDatabase,
  teardownDatabase,
  createTestUserWithSession,
  generateSessionHeader,
  request
} = require('../../lib/test-utils');

beforeAll(async () => {
  await setupDatabase();
  await User.remove();
});

beforeEach(async () => {
  await User.remove();
});

afterAll(teardownDatabase);

describe('Users', () => {
  test('It should be able to register and authenticate a user', async () => {
    let response;
    let data;

    const signupParams = {
      username: 'john',
      email: 'john@galt.com',
      password: 'hello',
      passwordRepeat: 'hello',
      name: 'John Galt',
    };

    response = await request(app)
      .post('/1/users')
      .send(signupParams);

    ({ data } = response.body);

    expect(response.status).toBe(200);
    expect(data.name).toBe(signupParams.name);
    expect(!!data.password).toBe(false);
    expect(!!await User.findOne({ username: 'john' })).toBe(true);

    response = await request(app)
      .post('/1/users/sessions')
      .send({ email: signupParams.email, password: 'wrong' });

    // expect(response.status, 401);
    expect(response.body.error.message).toBe('Incorrect email or password');

    response = await request(app)
      .post('/1/users/sessions')
      .send(signupParams);

    ({ data } = response.body);

    expect(!!data.user.password).toBe(false);
    const { token } = data;

    response = await request(app)
      .get('/1/users/self')
      .set(...generateSessionHeader(token));

    ({ data } = response.body);

    expect(data.name).toBe(signupParams.name);
    expect(!!data.password).toBe(false);
  });

  test('It should be update my account', async () => {
    const { token } = await createTestUserWithSession('john');
    const response = await request(app)
      .post('/1/users/self')
      .send({ name: 'John Galt' })
      .set(...generateSessionHeader(token));

    const { error } = response.body;

    expect(error).toBe(undefined);
    expect((await User.findOne({ username: 'john' })).name).toBe('John Galt');
  });

  test('It should be delete my account', async () => {
    const { token } = await createTestUserWithSession('john');

    const response = await request(app)
      .delete('/1/users/self')
      .set(...generateSessionHeader(token));
    const { error } = response.body;
    expect(error).toBe(undefined);
    expect((await User.count())).toBe(0);
  });

  test('It should be able to get a user for admin', async () => {
    const { user, token } = await createTestUserWithSession('dominiek', 'admin');
    const response = await request(app)
      .get(`/1/users/${user._id}`)
      .set(...generateSessionHeader(token));
    const { data, error } = response.body;
    expect(error).toBe(undefined);
    expect(data.role).toBe('admin');
  });

  test('It should be able to get a delete user for admin (404)', async () => {
    await createTestUserWithSession('john');
    const { token } = await createTestUserWithSession('dominiek', 'admin');
    const response = await request(app)
      .delete('/1/users/5a0e88cd0f94c22aae7f6f7c')
      .set(...generateSessionHeader(token));
    const { error } = response.body;
    expect(error.message).toBe('No such user');
  });

  test('It should be able to get a delete user for admin', async () => {
    const { user } = await createTestUserWithSession('john');
    const { token } = await createTestUserWithSession('dominiek', 'admin');
    const response = await request(app)
      .delete(`/1/users/${user._id}`)
      .set(...generateSessionHeader(token));
    const { data, error } = response.body;
    expect(error).toBe(undefined);
    expect(data.success).toBe(true);
    expect(await User.count()).toBe(1);
  });

  test('It should be able to get a delete user for admin', async () => {
    const { user } = await createTestUserWithSession('john');
    const { token } = await createTestUserWithSession('dominiek', 'admin');
    const response = await request(app)
      .post(`/1/users/${user._id}`)
      .send({ name: 'John Galt' })
      .set(...generateSessionHeader(token));
    const { error } = response.body;
    expect(error).toBe(undefined);

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.name).toBe('John Galt');
  });
});