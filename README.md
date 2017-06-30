# Rutt

Angular inspired route config for Hapi

## Example

```typescript
import { Rutt, Route, RuttRequest } from 'rutt';
import { Post } from './models/post';

const rutt = new Rutt();

class PostsController {
  listPosts() {
    return Post.all();
  }

  getPost(req: RuttRequest) {
    const postId = req.params['postId'];

    // Returned promises are automatically resolved
    return Post.find(postId);
  }

  createPost() {
  	return Post.create({ title: '', body: '' });
  }
}

/**
 * Registers routes:
 * get  /posts
 * post /posts
 * get  /posts/{postId}
 */
const appRoutes: Route[] = [
  {
    path: 'posts',
    controller: PostsController,
    handler: 'listPosts',
    children: [
      { path: '', method: 'post', handler: 'createPost' },
      { path: ':postId', handler: 'getPost' },
    ],
  },
];

rutt.connection({ port: 3000 });
rutt.routes(appRoutes);

rutt
  .start()
  .then(() => console.log(`Server running at: ${rutt.server.info.uri}`))
  .catch(err => console.error('Error starting server', err));
```
