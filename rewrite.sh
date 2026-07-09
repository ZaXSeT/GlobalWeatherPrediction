export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --env-filter '
if [ "$GIT_COMMIT" = "3389be2694c5489e6e0173f805ecc2076b79a86b" ] || \
   [ "$GIT_COMMIT" = "a31fc47ac8f734aa12683bfff803787085070c46" ] || \
   [ "$GIT_COMMIT" = "b1c673773018a68ae926231a65de3e24973d67b5" ] || \
   [ "$GIT_COMMIT" = "c2e61ecc65d229289f28b82f79fb7276e4765ce2" ] || \
   [ "$GIT_COMMIT" = "a1b25e5f2727571ddfd7a203db0c9d28db2d20c6" ]; then
   export GIT_AUTHOR_NAME="Zacky Setiawan"
   export GIT_AUTHOR_EMAIL="zackyxie123@gmail.com"
   export GIT_COMMITTER_NAME="Zacky Setiawan"
   export GIT_COMMITTER_EMAIL="zackyxie123@gmail.com"
fi
' -- --all
