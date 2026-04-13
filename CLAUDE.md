When you have a function with more than one parameter with the same type (i.e `string`), use an object parameter instead of positional parameters:

// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};


Anything marked as a 'service' (by the name of the file, for instance `authTokenService.ts`) should have test written for them in an accompanying `.test.ts` file 